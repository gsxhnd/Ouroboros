package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/gsxhnd/ourboros/internal/cli"
	"github.com/gsxhnd/ourboros/internal/logs"
	"github.com/gsxhnd/ourboros/internal/serve"
	"github.com/gsxhnd/ourboros/internal/version"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, nil)))
	command, err := cli.Parse(os.Args[1:])
	if err != nil {
		if cli.IsHelp(err) {
			fmt.Print(cli.Help())
			return
		}
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	switch command.Name {
	case "help", "":
		fmt.Print(cli.Help())
	case "version":
		fmt.Println("ourboros v" + version.Version)
	case "server":
		if err := run(command.Server); err != nil {
			slog.Error("server exited", "err", err)
			os.Exit(1)
		}
	case "desktop":
		fmt.Fprintln(os.Stderr, "the desktop window is a separate binary: run ./cmd/desktop (or `task dev`)")
		os.Exit(2)
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n", command.Name)
		os.Exit(2)
	}
}

func run(args cli.ServerArgs) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	// 日志落到数据目录的 log 文件夹，同时保留 stderr；打不开就降级为仅 stderr。
	logDir := args.LogDir
	if logDir == "" {
		logDir = filepath.Join(args.DataDir, "log")
	}
	logFile, err := logs.Setup(logDir)
	if err != nil {
		slog.Warn("log file is disabled, keeping stderr only", "dir", logDir, "err", err)
	} else {
		slog.SetDefault(slog.New(slog.NewTextHandler(logFile, nil)))
		defer func() { _ = logFile.Close() }()
	}
	running, err := serve.Run(ctx, args)
	if err != nil {
		return err
	}
	slog.Info("ourboros server listening", "url", running.URL)
	<-ctx.Done()
	<-running.Done
	return nil
}
