package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"runtime"
	"sync"
	"syscall"

	"github.com/gsxhnd/ourboros/internal/cli"
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

	// 应用菜单（macOS 顶部菜单栏，含 About/Edit/Window 标准角色）
	appMenu := app.Menu.New()
	appMenu.AddRole(application.AppMenu)
	appMenu.AddRole(application.EditMenu)
	appMenu.AddRole(application.WindowMenu)
	app.Menu.Set(appMenu)

	windowOptions := application.WebviewWindowOptions{
		Name:             "main",
		Title:            "Ourboros",
		Width:            1440,
		Height:           900,
		MinWidth:         960,
		MinHeight:        640,
		URL:              running.URL + "/?platform=" + runtime.GOOS,
		BackgroundColour: application.NewRGB(15, 17, 21),
	}
	if runtime.GOOS == "darwin" {
		// 隐藏标题栏并让内容铺满窗口，保留原生“红绿灯”按钮。
		windowOptions.Mac = application.MacWindow{
			TitleBar: application.MacTitleBarHidden,
		}
	}
	win := app.Window.NewWithOptions(windowOptions)

	// 用户点击关闭按钮时隐藏窗口而不是销毁（托盘负责唤回 / 退出）。
	win.RegisterHook(events.Common.WindowClosing, func(windowEvent *application.WindowEvent) {
		windowEvent.Cancel()
		win.Hide()
	})

	// Ctrl+C / SIGTERM 与托盘“退出”走同一条路径，保证 rclone 与挂载被正常清理。
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-signals
		app.Quit()
	}()

	shell := newTrayShell(ctx, app, win, running.State)
	app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(*application.ApplicationEvent) {
		go shell.run()
	})

	if err := app.Run(); err != nil {
		slog.Error("desktop exited", "err", err)
		shutdown()
		os.Exit(1)
	}
	shutdown()
}
