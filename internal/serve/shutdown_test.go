package serve

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/gsxhnd/ourboros/internal/app"
)

// An open SSE stream used to hold server.Shutdown for its full 5s timeout,
// which made quitting feel stuck. Shutdown must now finish promptly.
func TestShutdownDoesNotWaitForOpenEventStream(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	state, err := app.New(ctx, app.Config{DataDir: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	running, err := start(ctx, state, "127.0.0.1", 0, "")
	if err != nil {
		t.Fatal(err)
	}

	// The SSE handler only flushes headers on its first write (the 15s
	// keepalive), so the request must not be awaited here. The connection is
	// open as soon as the request is in flight.
	streamCtx, stopStream := context.WithCancel(context.Background())
	defer stopStream()
	go func() {
		req, _ := http.NewRequestWithContext(streamCtx, http.MethodGet, running.URL+"/api/mounts/events", nil)
		if resp, err := http.DefaultClient.Do(req); err == nil {
			_ = resp.Body.Close()
		}
	}()
	time.Sleep(200 * time.Millisecond)

	started := time.Now()
	cancel()
	select {
	case <-running.Done:
	case <-time.After(3 * time.Second):
		t.Fatal("shutdown still waiting on the open event stream after 3s")
	}
	if elapsed := time.Since(started); elapsed > 2*time.Second {
		t.Fatalf("shutdown took %s, expected well under the 5s timeout", elapsed)
	}
}
