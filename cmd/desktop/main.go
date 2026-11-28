package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"sync"
	"syscall"

	"github.com/gsxhnd/ourboros/internal/cli"
	"github.com/gsxhnd/ourboros/internal/logs"
	"github.com/gsxhnd/ourboros/internal/serve"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, nil)))
	command, err := cli.Parse(append([]string{"desktop"}, os.Args[1:]...))
	if err != nil {
		if cli.IsHelp(err) {
			fmt.Print(cli.Help())
			return
		}
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	// 日志落到数据目录的 log 文件夹，同时保留 stderr；打不开就降级为仅 stderr。
	logDir := command.Server.LogDir
	if logDir == "" {
		logDir = filepath.Join(command.Server.DataDir, "log")
	}
	logFile, err := logs.Setup(logDir)
	if err != nil {
		slog.Warn("log file is disabled, keeping stderr only", "dir", logDir, "err", err)
	} else {
		slog.SetDefault(slog.New(slog.NewTextHandler(logFile, nil)))
		defer func() { _ = logFile.Close() }()
	}
	running, err := serve.Run(ctx, command.Server)
	if err != nil {
		slog.Error("failed to start ourboros", "err", err)
		os.Exit(1)
	}
	slog.Info("ourboros desktop serving", "url", running.URL)

	// shutdown stops the HTTP server, unmounts, and stops rclone. Wails may
	// terminate the process right after OnShutdown returns, so this must not
	// rely on app.Run returning. Every quit path (tray, Cmd+Q, SIGTERM) goes
	// through here, and sync.Once keeps repeated calls harmless.
	var shutdownOnce sync.Once
	shutdown := func() {
		shutdownOnce.Do(func() {
			cancel()
			<-running.Done
		})
	}

	app := application.New(application.Options{
		Name:        "Ourboros",
		Description: "Web UI for rclone",
		OnShutdown:  shutdown,
		Mac: application.MacOptions{
			// The server must keep running after the window is closed:
			// the window hides to the system tray instead of quitting.
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
	})

	// 应用菜单（macOS 顶部菜单栏，含 About/Edit/View/Window 标准角色）。
	// View 菜单自带 Reload / 缩放 / 全屏；dev 构建（未打 -tags production）时
	// 额外包含 "Open Developer Tools"（Alt+Cmd+I），用于打开 WebView 检查器。
	// 打开检查器依赖 wails 的私有 API：dev 构建需带 -tags private_mac_apis
	// （见 Taskfile.yml darwin:build），否则菜单项是空操作。macOS 26 起
	// WebKit 重构了检查器，该私有路径（_WKInspector show/connect/attach）整体
	// 失效且上游未修复，此时改用 Safari「开发」菜单检查本窗口（dev 构建已在
	// 窗口创建时设置 inspectable），或直接在浏览器打开 Vite dev server 调试。
	// production 构建默认剥离该入口，需要排查线上问题时用
	// -tags devtools,private_mac_apis 保留。
	appMenu := app.Menu.New()
	appMenu.AddRole(application.AppMenu)
	appMenu.AddRole(application.EditMenu)
	appMenu.AddRole(application.ViewMenu)
	appMenu.AddRole(application.WindowMenu)
	app.Menu.Set(appMenu)

	pageURL := desktopPageURL(running.URL)
	win := newMainWindow(app, pageURL)
	installSignalQuit(app)

	shell := newTrayShell(ctx, app, win, running.Services, pageURL)
	app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(*application.ApplicationEvent) {
		go shell.run()
		go shell.watchSettings(running.Services.Events())
	})

	if err := app.Run(); err != nil {
		slog.Error("desktop exited", "err", err)
		shutdown()
		os.Exit(1)
	}
	shutdown()
}

// desktopPageURL is the page the window loads. wails3 dev 会注入
// FRONTEND_DEVSERVER_URL 指向 Vite dev server（其已把 /api 与 /health 代理到
// 本机服务），窗口直接加载它即可获得前端热更新；未注入时加载 Ourboros
// 自托管的前端（--webui / OURBOROS_WEB_DIR）。
func desktopPageURL(servedURL string) string {
	base := servedURL
	if devServer := os.Getenv("FRONTEND_DEVSERVER_URL"); devServer != "" {
		base = devServer
	}
	return base + "/?platform=" + runtime.GOOS
}

// newMainWindow creates the main window, restoring its last size and position,
// and wires the hooks that keep it alive in the tray and remember its frame.
func newMainWindow(app *application.App, pageURL string) *application.WebviewWindow {
	windowOptions := application.WebviewWindowOptions{
		Name:             "main",
		Title:            "Ourboros",
		Width:            1440,
		Height:           900,
		MinWidth:         960,
		MinHeight:        640,
		URL:              pageURL,
		BackgroundColour: application.NewRGB(15, 17, 21),
	}
	if runtime.GOOS == "darwin" {
		// 隐藏标题栏并让内容铺满窗口，保留原生“红绿灯”按钮。
		windowOptions.Mac = application.MacWindow{
			TitleBar: application.MacTitleBarHidden,
		}
	}
	// 上次退出时的窗口大小 / 位置：有合法记录就原位恢复，免得每次启动
	// 都回到默认尺寸重新拖。尺寸低于最小值视为损坏记录，走默认值。
	if state := loadWindowState(windowOptions.MinWidth, windowOptions.MinHeight); state != nil {
		windowOptions.Width = state.Width
		windowOptions.Height = state.Height
		windowOptions.X = state.X
		windowOptions.Y = state.Y
		windowOptions.InitialPosition = application.WindowXY
	}
	win := app.Window.NewWithOptions(windowOptions)

	// 用户点击关闭按钮时隐藏窗口而不是销毁（托盘负责唤回 / 退出）。
	win.RegisterHook(events.Common.WindowClosing, func(windowEvent *application.WindowEvent) {
		windowEvent.Cancel()
		win.Hide()
	})

	// 移动 / 缩放后立即把窗口几何写盘（见 window_state.go 的写入约定）。
	saveFrame := func(*application.WindowEvent) { saveWindowState(win) }
	win.RegisterHook(events.Common.WindowDidMove, saveFrame)
	win.RegisterHook(events.Common.WindowDidResize, saveFrame)
	return win
}

// installSignalQuit routes Ctrl+C / SIGTERM through the same quit path as the
// tray's "Quit", so rclone and mounts are cleaned up.
func installSignalQuit(app *application.App) {
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-signals
		app.Quit()
	}()
}
