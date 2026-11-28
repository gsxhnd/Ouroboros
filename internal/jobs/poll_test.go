package jobs

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/rclone"
)

// fakeRC is a minimal rclone RC server: each command maps to a canned reply,
// and every call is recorded so a test can assert what was sent.
type fakeRC struct {
	mu      sync.Mutex
	replies map[string]func(body map[string]any) map[string]any
	calls   []string
	server  *httptest.Server
}

func newFakeRC(t *testing.T) *fakeRC {
	t.Helper()
	f := &fakeRC{replies: map[string]func(map[string]any) map[string]any{}}
	f.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		var body map[string]any
		_ = json.Unmarshal(raw, &body)
		command := r.URL.Path[1:]
		f.mu.Lock()
		f.calls = append(f.calls, command)
		reply := f.replies[command]
		f.mu.Unlock()
		out := map[string]any{}
		if command == "core/version" {
			out = map[string]any{"version": "v1.70.0"}
		} else if reply != nil {
			out = reply(body)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(out)
	}))
	t.Cleanup(f.server.Close)
	return f
}

func (f *fakeRC) on(command string, reply func(body map[string]any) map[string]any) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.replies[command] = reply
}

func (f *fakeRC) called(command string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, c := range f.calls {
		if c == command {
			return true
		}
	}
	return false
}

func attach(t *testing.T, f *fakeRC) *rclone.Supervisor {
	t.Helper()
	rc := rclone.NewSupervisor(rclone.Settings{Bin: "rclone", RCURL: f.server.URL})
	if _, err := rc.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	return rc
}

type finished struct {
	edge     string
	snapshot Snapshot
}

// runPoll registers a running job, runs pollUntilDone to completion and
// returns what onFinish received (nil if it was never called).
func runPoll(t *testing.T, rc *rclone.Supervisor, rcloneJobID int64, limitBytes int64) (*Store, *finished) {
	t.Helper()
	var mu sync.Mutex
	var got *finished
	store := New(context.Background(), events.New(), rc, nil, func(edge string, snapshot Snapshot) {
		mu.Lock()
		defer mu.Unlock()
		got = &finished{edge, snapshot}
	})
	store.jobs["j"] = &record{
		snapshot:     Snapshot{ID: "j", EdgeID: "e", Status: StatusRunning},
		rcloneJobID:  &rcloneJobID,
		limitBytes:   limitBytes,
		limitDisplay: "1 KiB",
	}
	store.runningEdges["e"] = struct{}{}

	done := make(chan struct{})
	go func() { store.pollUntilDone("j", "e"); close(done) }()
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatal("pollUntilDone did not finish")
	}
	mu.Lock()
	defer mu.Unlock()
	return store, got
}

func jobStatus(finished, success bool, extra map[string]any) func(map[string]any) map[string]any {
	return func(map[string]any) map[string]any {
		out := map[string]any{"finished": finished, "success": success}
		for k, v := range extra {
			out[k] = v
		}
		return out
	}
}

func stats(bytes, errors float64) func(map[string]any) map[string]any {
	return func(map[string]any) map[string]any {
		return map[string]any{"bytes": bytes, "transfers": 2.0, "errors": errors}
	}
}

func TestPollSucceededJobIsReportedAndReleasesEdge(t *testing.T) {
	f := newFakeRC(t)
	f.on("core/stats", stats(2048, 0))
	f.on("job/status", jobStatus(true, true, nil))

	store, got := runPoll(t, attach(t, f), 7, 0)
	if got == nil || got.edge != "e" || got.snapshot.Status != StatusSucceeded {
		t.Fatalf("finished = %+v", got)
	}
	if got.snapshot.Progress.Bytes != 2048 || got.snapshot.FinishedAt == nil {
		t.Fatalf("snapshot = %+v", got.snapshot)
	}
	if store.IsRunning("e") {
		t.Fatal("edge lock not released")
	}
}

func TestPollFailedJobCarriesRcloneError(t *testing.T) {
	f := newFakeRC(t)
	f.on("core/stats", stats(10, 1))
	f.on("job/status", jobStatus(true, false, map[string]any{"error": "directory not found"}))

	_, got := runPoll(t, attach(t, f), 7, 0)
	if got == nil || got.snapshot.Status != StatusFailed {
		t.Fatalf("finished = %+v", got)
	}
	if got.snapshot.Error == nil || *got.snapshot.Error != "directory not found" {
		t.Fatalf("error = %v", got.snapshot.Error)
	}
}

func TestPollSuccessWithTransferErrorsIsPartialFailure(t *testing.T) {
	f := newFakeRC(t)
	f.on("core/stats", stats(100, 3))
	f.on("job/status", jobStatus(true, true, nil))

	_, got := runPoll(t, attach(t, f), 7, 0)
	if got == nil || got.snapshot.Status != StatusPartialFailed {
		t.Fatalf("finished = %+v", got)
	}
}

func TestPollInstantJobReadsFinalStatsWhenFirstSampleWasEmpty(t *testing.T) {
	f := newFakeRC(t)
	var mu sync.Mutex
	calls := 0
	f.on("core/stats", func(body map[string]any) map[string]any {
		mu.Lock()
		defer mu.Unlock()
		calls++
		if body["short"] == true {
			return map[string]any{"bytes": 0.0}
		}
		return map[string]any{"bytes": 4096.0}
	})
	f.on("job/status", jobStatus(true, true, nil))

	_, got := runPoll(t, attach(t, f), 7, 0)
	if got == nil || got.snapshot.Progress.Bytes != 4096 {
		t.Fatalf("bytes = %+v, want the follow-up stats", got)
	}
}

func TestPollExpiresJobWhenRcloneDisappears(t *testing.T) {
	f := newFakeRC(t)
	f.on("core/stats", stats(1, 0))
	f.on("job/status", jobStatus(false, false, nil))
	rc := attach(t, f)
	f.server.Close() // rclone goes away while the job is still running

	// With the endpoint gone every call errors, but Status() still reports a
	// session, so expire only triggers once the supervisor itself stops.
	if _, err := rc.Stop(context.Background()); err != nil {
		t.Logf("stop: %v", err)
	}
	store, got := runPoll(t, rc, 7, 0)
	if got != nil {
		t.Fatalf("an expired job is not a finished result: %+v", got)
	}
	if status := store.jobs["j"].snapshot.Status; status != StatusExpired {
		t.Fatalf("status = %q, want expired", status)
	}
	if store.IsRunning("e") {
		t.Fatal("edge lock not released")
	}
}

func TestPollStopsJobThatReachesTransferCap(t *testing.T) {
	f := newFakeRC(t)
	f.on("core/stats", stats(5000, 0)) // over the 1024-byte cap
	var mu sync.Mutex
	stopped := false
	f.on("job/stop", func(map[string]any) map[string]any {
		mu.Lock()
		stopped = true
		mu.Unlock()
		return map[string]any{}
	})
	f.on("job/status", func(map[string]any) map[string]any {
		mu.Lock()
		defer mu.Unlock()
		return map[string]any{"finished": stopped, "success": false}
	})

	_, got := runPoll(t, attach(t, f), 7, 1024)
	if !f.called("job/stop") {
		t.Fatal("job over the cap was never stopped")
	}
	if got == nil || got.snapshot.Status != StatusFailed {
		t.Fatalf("finished = %+v, a capped job ends as failed, not cancelled", got)
	}
	if got.snapshot.Error == nil || *got.snapshot.Error != "max transfer limit reached: 1 KiB" {
		t.Fatalf("error = %v", got.snapshot.Error)
	}
}

func TestPollKeepsCancelledStatusWhenJobFinishesAfterCancel(t *testing.T) {
	f := newFakeRC(t)
	f.on("core/stats", stats(10, 0))
	f.on("job/status", jobStatus(true, false, map[string]any{"error": "context canceled"}))
	rc := attach(t, f)

	store := New(context.Background(), events.New(), rc, nil, nil)
	rcloneJobID := int64(7)
	store.jobs["j"] = &record{
		snapshot:    Snapshot{ID: "j", EdgeID: "e", Status: StatusCancelling},
		rcloneJobID: &rcloneJobID,
	}
	store.runningEdges["e"] = struct{}{}
	store.pollUntilDone("j", "e")

	snapshot := store.jobs["j"].snapshot
	if snapshot.Status != StatusCancelled {
		t.Fatalf("status = %q, want cancelled", snapshot.Status)
	}
	if snapshot.Error != nil {
		t.Fatalf("a cancelled job must not show rclone's cancel error: %v", *snapshot.Error)
	}
}
