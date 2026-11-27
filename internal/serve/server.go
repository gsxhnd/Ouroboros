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
	"github.com/gsxhnd/ourboros/internal/service"
)

type Running struct {
	URL  string
	Done <-chan struct{}
	// Services exposes the application use cases so the desktop shell can drive
	// them directly (for example from the system tray) instead of going over HTTP.
	Services *service.Services
}

func start(ctx context.Context, state *app.State, svcs *service.Services, host string, port int, webDir string) (*Running, error) {
	if host == "" {
		host = "127.0.0.1"
	}
	listener, err := net.Listen("tcp", net.JoinHostPort(host, strconv.Itoa(port)))
	if err != nil {
		return nil, err
	}
	// SSE streams never finish on their own. Tying every request context to ctx
	// lets shutdown end them immediately instead of waiting out the timeout.
	server := &http.Server{
		Handler:     httpapi.Handler(svcs, webDir),
		BaseContext: func(net.Listener) context.Context { return ctx },
	}
	go func() {
		if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
			slog.Error("http server stopped", "err", err)
		}
	}()

	done := make(chan struct{})
	go func() {
		defer close(done)
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
		state.Close()
	}()
	return &Running{URL: "http://" + listener.Addr().String(), Done: done, Services: svcs}, nil
}
