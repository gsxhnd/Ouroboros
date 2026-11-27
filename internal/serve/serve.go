package serve

import (
	"context"
	"log/slog"

	"github.com/gsxhnd/ourboros/internal/app"
	"github.com/gsxhnd/ourboros/internal/cli"
	"github.com/gsxhnd/ourboros/internal/scheduler"
	"github.com/gsxhnd/ourboros/internal/service"
	"github.com/gsxhnd/ourboros/internal/webui"
)

func Run(ctx context.Context, args cli.ServerArgs) (*Running, error) {
	if err := cli.AssertBindHost(args.Host, args.AuthToken); err != nil {
		return nil, err
	}
	webDir, err := resolveWeb(args)
	if err != nil {
		return nil, err
	}
	state, err := app.New(ctx, appConfig(args))
	if err != nil {
		return nil, err
	}
	if args.AuthToken != "" {
		slog.Info("http auth enabled: /api requires a bearer token")
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
	go scheduler.Run(ctx, state.Workspace, state.Jobs)
	return start(ctx, state, service.New(state), args.Host, args.Port, webDir)
}

func resolveWeb(args cli.ServerArgs) (string, error) {
	if args.WebDirExplicit {
		return webui.Require(args.WebDir)
	}
	return webui.Discover(), nil
}

func appConfig(args cli.ServerArgs) app.Config {
	return app.Config{
		DataDir:      args.DataDir,
		BindHost:     args.Host,
		BindPort:     args.Port,
		AuthToken:    args.AuthToken,
		RcloneBin:    args.RcloneBin,
		RcloneURL:    args.RcloneURL,
		RcloneConfig: args.RcloneConfig,
		RcloneUser:   args.RcloneUser,
		RclonePass:   args.RclonePass,
	}
}
