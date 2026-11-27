package main

import (
	"context"
	"embed"
	"log/slog"
	"runtime"
	"sync"
	"time"

	"github.com/gsxhnd/ourboros/internal/service"
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
	// Events emitted by the tray panel webview (see frontend/src/features/tray/tray-panel.tsx).
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
	svc   *service.Services
	tray  *application.SystemTray
	ctx   context.Context

	mu         sync.Mutex
	rcloneBusy bool
	bindings   []string
}

func newTrayShell(ctx context.Context, a *application.App, win *application.WebviewWindow, svc *service.Services, pageURL string) *trayShell {
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
		if tooltip := tray.Tooltip(t.input()); tooltip != shown {
			shown = tooltip
			t.tray.SetTooltip(tooltip)
		}
		select {
		case <-t.ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (t *trayShell) input() tray.Input {
	t.mu.Lock()
	busy := t.rcloneBusy
	t.mu.Unlock()
	return tray.Input{
		Rclone:     t.svc.Rclone.Status(),
		RcloneBusy: busy,
		Mounts:     t.svc.Mounts.List(),
		Jobs:       t.svc.SyncTasks.ListJobs(),
	}
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
		t.logResult(err)
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
		t.logResult(err)
	}()
}

// logResult logs the outcome of a tray action; failures are not surfaced
// anywhere else because the tray has no native menu to show them in.
func (t *trayShell) logResult(err error) {
	if err != nil {
		slog.Warn("tray action failed", "err", err)
	}
}
