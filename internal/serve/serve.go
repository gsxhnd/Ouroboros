package serve

import (
	"context"
	"log/slog"

	"github.com/gsxhnd/ourboros/internal/app"
	"github.com/gsxhnd/ourboros/internal/cli"
	"github.com/gsxhnd/ourboros/internal/webui"
)

func Run(ctx context.Context, args cli.ServerArgs) (*Running, error) {
	if err := cli.AssertBindHost(args.Host); err != nil {
		return nil, err
	}
	webDir, err := resolveWeb(args)
	if err != nil {
		return nil, err
	}
	state, err := app.New(ctx, args.Runtime())
	if err != nil {
		return nil, err
	}
	if args.NoAutoRclone || !state.Settings.Get().AutoStart {
		slog.Info("rclone auto-start disabled")
	} else if _, err := state.Rclone.EnsureRunning(ctx); err != nil {
		slog.Warn("rclone is not ready", "err", err)
	}
	if webDir != "" {
		slog.Info("serving web UI", "dir", webDir)
	} else {
		slog.Info("API-only mode. Pass --webui / --web-dir or set OURBOROS_WEB_DIR to serve the UI.")
	}
	return start(ctx, state, args.Host, args.Port, webDir)
}

func resolveWeb(args cli.ServerArgs) (string, error) {
	if args.WebDirExplicit {
		return webui.Require(args.WebDir)
	}
	return webui.Resolve("")
}
