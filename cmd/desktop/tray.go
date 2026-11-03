package main

import (
	"context"
	"embed"
	"log/slog"
	"runtime"
	"sync"
	"time"

	"github.com/gsxhnd/ourboros/internal/app"
	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/settings"
	"github.com/gsxhnd/ourboros/internal/tray"
	"github.com/wailsapp/wails/v3/pkg/application"
	wailsevents "github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed assets/tray-template.png assets/tray-color.png
var trayAssets embed.FS

const (
	trayRefreshInterval = 2 * time.Second
	trayActionTimeout   = 60 * time.Second
	trayPanelWidth      = 340
	trayPanelHeight     = 420
	trayPanelOffset     = 6
	// Events emitted by the tray panel webview (see web/src/components/tray-panel.tsx).
	trayOpenMainEvent = "ourboros:tray:open-main"
	trayQuitEvent     = "ourboros:tray:quit"
	trayAutostartEvt  = "ourboros:tray:autostart"
)

// trayShell owns the system tray icon and its panel window. The panel is the
// only tray UI; it reads state from the HTTP API. Shortcuts are registered here
// and run the same actions as the panel buttons.
type trayShell struct {
	app   *application.App
	win   *application.WebviewWindow
	panel *application.WebviewWindow
	svc   *app.State
	tray  *application.SystemTray
	ctx   context.Context

	mu         sync.Mutex
	rcloneBusy bool
	lastError  string
	bindings   []string
}

func newTrayShell(ctx context.Context, a *application.App, win *application.WebviewWindow, svc *app.State, pageURL string) *trayShell {
	t := &trayShell{
		app: a,
		win: win,
		svc: svc,
		ctx: ctx,
	}
	t.panel = a.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             "tray",
		Title:            "Ourboros",
		Width:            trayPanelWidth,
		Height:           trayPanelHeight,
		URL:              pageURL + "&view=tray",
		Frameless:        true,
		Hidden:           true,
		AlwaysOnTop:      true,
		DisableResize:    true,
		BackgroundColour: application.NewRGB(15, 17, 21),
		Windows: application.WindowsWindow{
			HiddenOnTaskbar: true,
		},
	})
	t.panel.RegisterHook(wailsevents.Common.WindowLostFocus, func(*application.WindowEvent) {
		t.panel.Hide()
	})
	a.Event.On(trayOpenMainEvent, func(*application.CustomEvent) { t.showWindow() })
	a.Event.On(trayQuitEvent, func(*application.CustomEvent) { a.Quit() })
	a.Event.On(trayAutostartEvt, func(ev *application.CustomEvent) {
		enable, ok := ev.Data.(bool)
		if !ok {
			return
		}
		t.setAutostart(enable)
	})

	t.tray = a.SystemTray.New()
	t.tray.AttachWindow(t.panel).WindowOffset(trayPanelOffset)
	if runtime.GOOS == "darwin" {
		// template icon 会随浅色/深色菜单栏自动反色
		if icon, err := trayAssets.ReadFile("assets/tray-template.png"); err == nil {
			t.tray.SetTemplateIcon(icon)
		}
	} else if icon, err := trayAssets.ReadFile("assets/tray-color.png"); err == nil {
		t.tray.SetIcon(icon)
	}
	t.tray.SetTooltip("Ourboros — Web UI for rclone")
	// 左键切换面板；不设置原生菜单，托盘只保留这一个面板入口。
	t.tray.OnClick(t.togglePanel)
	return t
}

// run keeps the tooltip in sync with the services until ctx is cancelled. It
// must start after the Wails event loop is running (ApplicationStarted).
func (t *trayShell) run() {
	ticker := time.NewTicker(trayRefreshInterval)
	defer ticker.Stop()
	var shown string
	for {
		model := tray.Build(t.input())
		if model.Tooltip != shown {
			shown = model.Tooltip
			t.tray.SetTooltip(model.Tooltip)
		}
		select {
		case <-t.ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// watchSettings re-registers shortcuts whenever the settings change.
func (t *trayShell) watchSettings(bus *events.Bus) {
	ch, cancel := bus.Subscribe()
	defer cancel()
	t.registerShortcuts(t.svc.Settings.Get())
	for {
		select {
		case <-t.ctx.Done():
			return
		case ev, ok := <-ch:
			if !ok {
				return
			}
			if ev.Name != "settings" {
				continue
			}
			if doc, ok := ev.Payload.(settings.Document); ok {
				t.registerShortcuts(doc)
			}
		}
	}
}

// registerShortcuts replaces the previously registered accelerators with the
// ones from doc. Each action runs on the Go side, the same as the panel buttons.
func (t *trayShell) registerShortcuts(doc settings.Document) {
	t.mu.Lock()
	for _, accel := range t.bindings {
		t.app.KeyBinding.Remove(accel)
	}
	t.bindings = nil
	t.mu.Unlock()

	actions := map[string]func(){
		"show_main":     t.showWindow,
		"toggle_panel":  t.togglePanel,
		"toggle_rclone": t.rcloneToggleAction,
		"quit":          func() { t.app.Quit() },
	}
	resolved := doc.ResolvedShortcuts()
	for _, action := range settings.ShortcutActions {
		accel := resolved[action]
		run := actions[action]
		if accel == "" || run == nil {
			continue
		}
		t.app.KeyBinding.Add(accel, func(application.Window) { run() })
		t.mu.Lock()
		t.bindings = append(t.bindings, accel)
		t.mu.Unlock()
	}
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

func (t *trayShell) showWindow() {
	t.panel.Hide()
	t.win.Show()
	t.win.Focus()
}

func (t *trayShell) togglePanel() {
	t.tray.ToggleWindow()
}

// rcloneToggleAction starts rclone when it is stopped and stops it when running.
func (t *trayShell) rcloneToggleAction() {
	t.mu.Lock()
	busy := t.rcloneBusy
	t.mu.Unlock()
	if busy {
		return
	}
	t.toggleRclone(t.svc.Rclone.Status().Running)
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

// setResult records the outcome of a tray action (nil clears the previous error).
func (t *trayShell) setResult(err error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.lastError = ""
	if err != nil {
		slog.Warn("tray action failed", "err", err)
		t.lastError = err.Error()
	}
}
