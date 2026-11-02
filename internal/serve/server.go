package serve

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/gsxhnd/ourboros/internal/app"
	"github.com/gsxhnd/ourboros/internal/httpapi"
	"github.com/gsxhnd/ourboros/internal/scheduler"
)

type Running struct {
	URL  string
	Done <-chan struct{}
	// State exposes the live services so the desktop shell can drive them
	// directly (for example from the system tray) instead of going over HTTP.
	State *app.State
}

func start(ctx context.Context, state *app.State, host string, port int, webDir string) (*Running, error) {
	if host == "" {
		host = "127.0.0.1"
	}
	listener, err := net.Listen("tcp", net.JoinHostPort(host, strconv.Itoa(port)))
	if err != nil {
		return nil, err
	}
	server := &http.Server{Handler: httpapi.Handler(state, webDir)}
	go func() {
		if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
			slog.Error("http server stopped", "err", err)
		}
	}()
	go scheduler.Run(ctx, state.Workspace, state.Jobs, state.Rclone)

	done := make(chan struct{})
	go func() {
		defer close(done)
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
		state.Close()
	}()
	return &Running{URL: "http://" + listener.Addr().String(), Done: done, State: state}, nil
}
