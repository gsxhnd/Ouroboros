package main

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"log/slog"
	"reflect"
	"runtime"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/gsxhnd/ourboros/internal/app"
	"github.com/gsxhnd/ourboros/internal/mounts"
	"github.com/gsxhnd/ourboros/internal/tray"
	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed assets/tray-template.png assets/tray-color.png
var trayAssets embed.FS

const (
	trayRefreshInterval = 2 * time.Second
	trayActionTimeout   = 60 * time.Second
	trayErrorMaxRunes   = 80
)

// trayShell owns the system tray icon and its menu. The menu is a projection of
// tray.Model, which is rebuilt only when that model changes. Actions run in
// goroutines and report back through setResult, then request a refresh.
type trayShell struct {
	app   *application.App
	win   *application.WebviewWindow
	svc   *app.State
	tray  *application.SystemTray
	menu  *application.Menu
	ctx   context.Context
	wake  chan struct{}
	shown tray.Model
	// rendered is only read and written by the render loop.
	rendered bool

	mu         sync.Mutex
	rcloneBusy bool
	lastError  string
}

func newTrayShell(ctx context.Context, a *application.App, win *application.WebviewWindow, svc *app.State) *trayShell {
	t := &trayShell{
		app:  a,
		win:  win,
		svc:  svc,
		ctx:  ctx,
		wake: make(chan struct{}, 1),
	}
	t.tray = a.SystemTray.New()
	if runtime.GOOS == "darwin" {
		// template icon 会随浅色/深色菜单栏自动反色
		if icon, err := trayAssets.ReadFile("assets/tray-template.png"); err == nil {
			t.tray.SetTemplateIcon(icon)
		}
	} else if icon, err := trayAssets.ReadFile("assets/tray-color.png"); err == nil {
		t.tray.SetIcon(icon)
	}
	t.tray.SetTooltip("Ourboros — Web UI for rclone")
	t.menu = a.Menu.New()
	t.tray.SetMenu(t.menu)

	// 左键点击唤回窗口；右键弹出菜单（默认行为，已设置菜单）。
	t.tray.OnClick(t.showWindow)
	return t
}

// run keeps the menu in sync with the services until ctx is cancelled. It must
// start after the Wails event loop is running (ApplicationStarted).
func (t *trayShell) run() {
	ticker := time.NewTicker(trayRefreshInterval)
	defer ticker.Stop()
	t.render()
	for {
		select {
		case <-t.ctx.Done():
			return
		case <-ticker.C:
		case <-t.wake:
		}
		t.render()
	}
}

// requestRefresh schedules a render without blocking; concurrent requests
// coalesce into a single pending wake-up.
func (t *trayShell) requestRefresh() {
	select {
	case t.wake <- struct{}{}:
	default:
	}
}

func (t *trayShell) render() {
	model := tray.Build(t.input())
	if t.rendered && reflect.DeepEqual(model, t.shown) {
		return
	}
	t.shown = model
	t.rendered = true
	// Menu.Update and SetTooltip dispatch to the main thread themselves. Do not
	// wrap them in InvokeSync: it is not re-entrant and would deadlock.
	t.tray.SetTooltip(model.Tooltip)
	t.buildMenu(model)
}

func (t *trayShell) input() tray.Input {
	t.mu.Lock()
	busy, lastErr := t.rcloneBusy, t.lastError
	t.mu.Unlock()

	in := tray.Input{
		Workspace:  t.svc.Workspace.Get(),
		Rclone:     t.svc.Rclone.Status(),
		RcloneBusy: busy,
		Mounts:     t.svc.Mounts.List(t.svc.Workspace),
		Jobs:       t.svc.Jobs.List(),
		LastError:  lastErr,
	}
	if enabled, err := t.app.Autostart.IsEnabled(); err == nil {
		in.Autostart = &enabled
	}
	return in
}

func (t *trayShell) buildMenu(m tray.Model) {
	t.menu.Clear()

	header := t.menu.Add("Ourboros")
	header.SetEnabled(false)
	t.menu.Add(m.StatusLine).SetEnabled(false)
	if m.LastError != "" {
		t.menu.Add("操作失败：" + truncate(m.LastError, trayErrorMaxRunes)).SetEnabled(false)
	}
	t.menu.AddSeparator()

	t.menu.Add("打开 Ourboros").OnClick(func(*application.Context) { t.showWindow() })
	t.menu.AddSeparator()

	running := m.RcloneRunning
	t.menu.Add(m.ToggleLabel).
		SetEnabled(!m.RcloneBusy).
		OnClick(func(*application.Context) { t.toggleRclone(running) })

	t.buildMountMenu(m)
	t.buildJobMenu(m)
	t.menu.AddSeparator()

	if m.Autostart != nil {
		enable := !*m.Autostart
		t.menu.AddCheckbox("开机时启动", *m.Autostart).
			OnClick(func(*application.Context) { t.setAutostart(enable) })
	}
	t.menu.AddSeparator()
	t.menu.Add("退出 Ourboros").OnClick(func(*application.Context) { t.app.Quit() })

	t.menu.Update()
}

func (t *trayShell) buildMountMenu(m tray.Model) {
	sub := t.menu.AddSubmenu(fmt.Sprintf("挂载（已挂载 %d）", m.MountedCount))
	if len(m.Mounts) == 0 {
		sub.Add("没有挂载连接，请在主窗口的“挂载”页创建").SetEnabled(false)
		return
	}
	for _, row := range m.Mounts {
		label := row.Label
		if row.Hint != "" {
			label += "  ·  " + row.Hint
		}
		edgeID, mounted := row.EdgeID, row.Checked
		sub.AddCheckbox(label, row.Checked).
			SetEnabled(row.Enabled).
			OnClick(func(*application.Context) { t.toggleMount(edgeID, mounted) })
	}
}

func (t *trayShell) buildJobMenu(m tray.Model) {
	sub := t.menu.AddSubmenu(fmt.Sprintf("同步任务（运行中 %d）", m.TotalJobs))
	if m.TotalJobs == 0 {
		sub.Add("没有运行中的任务").SetEnabled(false)
		return
	}
	for _, job := range m.RunningJobs {
		sub.Add(job.Label).SetEnabled(false)
	}
	if more := m.TotalJobs - len(m.RunningJobs); more > 0 {
		sub.Add(fmt.Sprintf("……还有 %d 个", more)).SetEnabled(false)
	}
	sub.AddSeparator()
	sub.Add("停止全部任务").OnClick(func(*application.Context) { t.stopAllJobs() })
}

func (t *trayShell) showWindow() {
	t.win.Show()
	t.win.Focus()
}

func (t *trayShell) toggleRclone(running bool) {
	t.setRcloneBusy(true)
	go func() {
		ctx, cancel := context.WithTimeout(t.ctx, trayActionTimeout)
		defer cancel()
		var err error
		if running {
			_, err = t.svc.Rclone.Stop(ctx)
		} else {
			_, err = t.svc.Rclone.EnsureRunning(ctx)
		}
		t.setRcloneBusy(false)
		t.setResult(err)
	}()
}

func (t *trayShell) setRcloneBusy(busy bool) {
	t.mu.Lock()
	t.rcloneBusy = busy
	t.mu.Unlock()
	t.requestRefresh()
}

func (t *trayShell) toggleMount(edgeID string, mounted bool) {
	go func() {
		var err error
		if mounted {
			_, err = t.svc.Mounts.Stop(edgeID)
		} else {
			err = startMount(t.svc, edgeID)
		}
		t.setResult(err)
	}()
}

// startMount reports a mount that exits right after spawning as an error. The
// supervisor returns such a snapshot with a nil error, so the status is checked
// here to surface the failure in the tray.
func startMount(svc *app.State, edgeID string) error {
	snapshot, err := svc.Mounts.Start(svc.Rclone, svc.Workspace, edgeID)
	if err != nil {
		return err
	}
	if snapshot.Status == mounts.StatusFailed {
		if snapshot.Error != nil {
			return errors.New(*snapshot.Error)
		}
		return errors.New("挂载失败")
	}
	return nil
}

func (t *trayShell) stopAllJobs() {
	go func() {
		var firstErr error
		for _, job := range t.svc.Jobs.List() {
			if job.Status.Terminal() {
				continue
			}
			if _, err := t.svc.Jobs.Stop(t.svc.Rclone, job.ID); err != nil && firstErr == nil {
				firstErr = err
			}
		}
		t.setResult(firstErr)
	}()
}

func (t *trayShell) setAutostart(enable bool) {
	go func() {
		var err error
		if enable {
			err = t.app.Autostart.Enable()
		} else {
			err = t.app.Autostart.Disable()
		}
		if err != nil {
			slog.Warn("update launch-at-login failed", "enable", enable, "err", err)
		}
		t.setResult(err)
	}()
}

// setResult records the outcome of a tray action (nil clears the previous
// error) and schedules a refresh so the menu reflects the new state.
func (t *trayShell) setResult(err error) {
	t.mu.Lock()
	t.lastError = ""
	if err != nil {
		slog.Warn("tray action failed", "err", err)
		t.lastError = err.Error()
	}
	t.mu.Unlock()
	t.requestRefresh()
}

func truncate(s string, maxRunes int) string {
	if utf8.RuneCountInString(s) <= maxRunes {
		return s
	}
	runes := []rune(s)
	return string(runes[:maxRunes]) + "…"
}
