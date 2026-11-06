package jobs

import (
	"context"
	"testing"
	"time"

	"github.com/gsxhnd/ourboros/internal/events"
)

func unixTime(unix int) time.Time {
	return time.Unix(int64(unix), 0).UTC()
}

// A poller that notices a job finished after it was cancelled must not
// overwrite the cancelled status, nor release the edge lock that a newer job
// on the same edge now holds.
func TestFinishIsIdempotentAndKeepsNewerEdgeLock(t *testing.T) {
	store := New(context.Background(), events.New())
	const edge = "edge-1"

	store.jobs["old"] = &record{snapshot: Snapshot{ID: "old", EdgeID: edge, Status: StatusRunning}}
	store.runningEdges[edge] = struct{}{}
	if _, err := store.finish("old", edge, StatusCancelled, nil, nil); err != nil {
		t.Fatalf("cancel old job: %v", err)
	}

	// A new job starts on the same edge once the old one is cancelled.
	store.jobs["new"] = &record{snapshot: Snapshot{ID: "new", EdgeID: edge, Status: StatusRunning}}
	store.runningEdges[edge] = struct{}{}

	// The old job's poller reports success late.
	snapshot, err := store.finish("old", edge, StatusSucceeded, nil, nil)
	if err != nil {
		t.Fatalf("late finish: %v", err)
	}
	if snapshot.Status != StatusCancelled {
		t.Fatalf("status overwritten: got %q, want %q", snapshot.Status, StatusCancelled)
	}
	if !store.IsRunning(edge) {
		t.Fatal("late finish of old job released the lock held by the new job")
	}
}

// 多余的已完成任务裁剪掉最旧的一批，且永远不会裁掉正在运行的任务。
func TestPruneFinishedKeepsNewestAndRunning(t *testing.T) {
	store := New(context.Background(), events.New())
	const edge = "edge-1"

	// 3 finished jobs beyond the cap plus one that is still running and older.
	oldIDs := []string{}
	for i := 0; i < maxFinishedJobs+2; i++ {
		id := "done-" + string(rune('a'+i))
		snapshot := Snapshot{
			ID:        id,
			EdgeID:    edge,
			Status:    StatusSucceeded,
			StartedAt: unixTime(i),
		}
		store.jobs[id] = &record{snapshot: snapshot}
		oldIDs = append(oldIDs, id)
	}
	running := Snapshot{ID: "running", EdgeID: edge, Status: StatusRunning, StartedAt: unixTime(0)}
	store.jobs["running"] = &record{snapshot: running}

	store.pruneFinished()

	for _, id := range oldIDs[:2] {
		if _, ok := store.jobs[id]; ok {
			t.Fatalf("oldest finished job %q should have been pruned", id)
		}
	}
	if _, ok := store.jobs["running"]; !ok {
		t.Fatal("running job must never be pruned")
	}
	remaining := 0
	for _, record := range store.jobs {
		if record.snapshot.Status.Terminal() {
			remaining++
		}
	}
	if remaining > maxFinishedJobs {
		t.Fatalf("finished jobs = %d, want <= %d", remaining, maxFinishedJobs)
	}
}

// 取消中的任务不应被 poller 的失败判定覆盖成 failed，最终应为 cancelled。
func TestReconcileCancel(t *testing.T) {
	if got := reconcileCancel(StatusCancelling, StatusFailed); got != StatusCancelled {
		t.Fatalf("reconcileCancel(cancelling, failed) = %q", got)
	}
	if got := reconcileCancel(StatusCancelling, StatusSucceeded); got != StatusCancelled {
		t.Fatalf("reconcileCancel(cancelling, succeeded) = %q", got)
	}
	if got := reconcileCancel(StatusRunning, StatusPartialFailed); got != StatusPartialFailed {
		t.Fatalf("reconcileCancel(running, partial) = %q", got)
	}
}

// waitForTerminal 在任务运行期间超时返回 false；任务终态后立即返回快照。
func TestWaitForTerminal(t *testing.T) {
	store := New(context.Background(), events.New())
	store.jobs["j"] = &record{snapshot: Snapshot{ID: "j", EdgeID: "e", Status: StatusRunning}}

	if _, ok := store.waitForTerminal("j", 50*time.Millisecond); ok {
		t.Fatal("running job must not be reported terminal")
	}

	store.finish("j", "e", StatusSucceeded, nil, nil)
	snapshot, ok := store.waitForTerminal("j", time.Second)
	if !ok || snapshot.Status != StatusSucceeded {
		t.Fatalf("ok=%v status=%q", ok, snapshot.Status)
	}
}

// waitForTerminal 感知 context 取消，避免关停时阻塞 cancelWait。
func TestWaitForTerminalHonorsContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	store := New(ctx, events.New())
	store.jobs["j"] = &record{snapshot: Snapshot{ID: "j", Status: StatusRunning}}
	cancel()
	if _, ok := store.waitForTerminal("j", 5*time.Second); ok {
		t.Fatal("cancelled context must stop the wait")
	}
}

// 没有 rclone 任务 ID 的记录：Stop 会先发 cancelling 事件，再快速收尾为 cancelled。
func TestStopFastPathWithoutRcloneJobID(t *testing.T) {
	bus := events.New()
	sub, done := bus.Subscribe()
	defer done()
	store := New(context.Background(), bus)
	store.jobs["j"] = &record{snapshot: Snapshot{ID: "j", EdgeID: "e", Status: StatusRunning}}
	store.runningEdges["e"] = struct{}{}

	snapshot, err := store.Stop(nil, "j")
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Status != StatusCancelled {
		t.Fatalf("status %q", snapshot.Status)
	}
	if store.IsRunning("e") {
		t.Fatal("edge lock must be released")
	}
	select {
	case ev := <-sub:
		if ev.Name != "job" {
			t.Fatalf("event name %q", ev.Name)
		}
		s := ev.Payload.(Snapshot)
		if s.Status != StatusCancelling && s.Status != StatusCancelled {
			t.Fatalf("event status %q", s.Status)
		}
	default:
		t.Fatal("cancelling snapshot was never emitted")
	}
}

// 记录存在 rclone 任务 ID 时，Stop 等待 poller 收尾；这里只覆盖 awaitJobID
// 的竞态窗口行为（完整链路需要真实 rclone）。
func TestAwaitJobID(t *testing.T) {
	store := New(context.Background(), events.New())
	const id int64 = 42
	store.jobs["j"] = &record{snapshot: Snapshot{ID: "j", EdgeID: "e", Status: StatusRunning}}
	store.runningEdges["e"] = struct{}{}

	// jobid 未落账：awaitJobID 超时返回 nil。
	if got := store.awaitJobID("j", 30*time.Millisecond); got != nil {
		t.Fatalf("unexpected id %v", got)
	}
	// 落账后立即可取。
	store.mu.Lock()
	jobID := id
	store.jobs["j"].rcloneJobID = &jobID
	store.mu.Unlock()
	if got := store.awaitJobID("j", time.Second); got == nil || *got != id {
		t.Fatalf("got %v", got)
	}
}
