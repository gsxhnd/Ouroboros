package history

import (
	"path/filepath"
	"testing"
	"time"
)

func newStore(t *testing.T) *Store {
	t.Helper()
	store, err := Open(filepath.Join(t.TempDir(), "history.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })
	return store
}

func sampleRun(id string, startedAt time.Time) Run {
	return Run{
		ID:        id,
		TaskID:    "task-1",
		Operation: "sync",
		Trigger:   "manual",
		Status:    StatusRunning,
		StartedAt: startedAt,
		Source:    Locator{Kind: "local", FS: "/tmp/src"},
		Target:    Locator{Kind: "remote", FS: "archive", Remote: "docs"},
	}
}

func finishInput(run Run, status string, started, finished time.Time) FinishInput {
	return FinishInput{
		TaskID:     run.TaskID,
		RunID:      run.ID,
		StartedAt:  started,
		Status:     status,
		FinishedAt: finished,
		Stats:      &RunStats{Bytes: 1024, Transfers: 3},
	}
}

func TestStartFinishList(t *testing.T) {
	store := newStore(t)
	started := time.Now().UTC().Add(-time.Minute)
	run := sampleRun("run-1", started)

	if err := store.Start(run); err != nil {
		t.Fatal(err)
	}
	runs, total, err := store.List("task-1", 0, 0)
	if err != nil || total != 1 || len(runs) != 1 {
		t.Fatalf("after start: %d %d %v", total, len(runs), err)
	}
	if runs[0].Status != StatusRunning {
		t.Fatalf("expected running, got %s", runs[0].Status)
	}

	finished := started.Add(30 * time.Second)
	if err := store.Finish(finishInput(run, StatusSucceeded, started, finished)); err != nil {
		t.Fatal(err)
	}
	runs, total, err = store.List("task-1", 0, 0)
	if err != nil || total != 1 || len(runs) != 1 {
		t.Fatalf("after finish: %d %d %v", total, len(runs), err)
	}
	got := runs[0]
	if got.Status != StatusSucceeded || got.Error != "" {
		t.Fatalf("unexpected run %+v", got)
	}
	if got.FinishedAt == nil || !got.FinishedAt.Equal(finished) {
		t.Fatalf("finished_at missing or wrong: %v", got.FinishedAt)
	}
	if got.Stats == nil || got.Stats.Bytes != 1024 || got.Stats.Transfers != 3 {
		t.Fatalf("stats missing: %+v", got.Stats)
	}
}

func TestFinishWithoutStartIsSkipped(t *testing.T) {
	store := newStore(t)
	err := store.Finish(FinishInput{
		TaskID: "task-1", RunID: "gone", StartedAt: time.Now().UTC(),
		Status: StatusFailed, FinishedAt: time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("finish without start should be a silent skip, got %v", err)
	}
	_, total, err := store.List("task-1", 0, 0)
	if err != nil || total != 0 {
		t.Fatalf("expected empty history: %d %v", total, err)
	}
}

func TestListOrdersNewestFirstAndPages(t *testing.T) {
	store := newStore(t)
	base := time.Now().UTC()
	var first, last Run
	for i := 0; i < 5; i++ {
		run := sampleRun(fmtRun(i), base.Add(time.Duration(i)*time.Second))
		if i == 0 {
			first = run
		}
		if i == 4 {
			last = run
		}
		if err := store.Start(run); err != nil {
			t.Fatal(err)
		}
		if err := store.Finish(finishInput(run, StatusSucceeded, run.StartedAt, run.StartedAt)); err != nil {
			t.Fatal(err)
		}
	}

	runs, total, err := store.List("task-1", 0, 0)
	if err != nil || total != 5 {
		t.Fatalf("total = %d err = %v", total, err)
	}
	if runs[0].ID != last.ID || runs[4].ID != first.ID {
		t.Fatalf("newest-first order broken: %v..%v", runs[0].ID, runs[4].ID)
	}

	page, total, err := store.List("task-1", 2, 1)
	if err != nil || total != 5 || len(page) != 2 {
		t.Fatalf("page = %d/%d err = %v", len(page), total, err)
	}
	if page[0].ID != runs[1].ID || page[1].ID != runs[2].ID {
		t.Fatalf("offset pagination broken: %v", page)
	}
	if _, total, _ = store.List("task-1", 10, 4); total != 5 {
		t.Fatalf("offset beyond end changed total: %d", total)
	}
}

func TestListUnknownTaskIsEmpty(t *testing.T) {
	store := newStore(t)
	runs, total, err := store.List("no-such-task", 50, 0)
	if err != nil || total != 0 || len(runs) != 0 {
		t.Fatalf("unknown task should be empty: %d %d %v", total, len(runs), err)
	}
}

func TestLatestByTaskKeepsNewestPerTask(t *testing.T) {
	store := newStore(t)
	base := time.Now().UTC()

	older := sampleRun("old", base.Add(-time.Hour))
	if err := store.Start(older); err != nil {
		t.Fatal(err)
	}
	if err := store.Finish(finishInput(older, StatusFailed, older.StartedAt, older.StartedAt)); err != nil {
		t.Fatal(err)
	}
	newer := sampleRun("new", base)
	newer.TaskID = "task-2"
	if err := store.Start(newer); err != nil {
		t.Fatal(err)
	}

	latest, err := store.LatestByTask()
	if err != nil {
		t.Fatal(err)
	}
	if len(latest) != 2 {
		t.Fatalf("expected one entry per task, got %d", len(latest))
	}
	if latest[0].TaskID != "task-2" || latest[0].ID != "new" {
		t.Fatalf("latest should be sorted by started_at desc: %+v", latest)
	}
	for _, run := range latest {
		if run.TaskID == "task-1" && (run.ID != "old" || run.Status != StatusFailed) {
			t.Fatalf("task-1 latest = %+v", run)
		}
	}
}

func TestRetentionCapsRunsPerTask(t *testing.T) {
	store := newStore(t)
	base := time.Now().UTC()
	for i := 0; i < maxRunsPerTask+5; i++ {
		run := sampleRun(fmtRun(i), base.Add(time.Duration(i)*time.Second))
		if err := store.Start(run); err != nil {
			t.Fatal(err)
		}
	}
	_, total, err := store.List("task-1", 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if total != maxRunsPerTask {
		t.Fatalf("retention cap broken: total = %d", total)
	}
	runs, _, _ := store.List("task-1", 0, 0)
	// 保留的应是最新的，最旧的 5 条被淘汰。
	if runs[len(runs)-1].ID != fmtRun(5) {
		t.Fatalf("oldest kept run should be run-5, got %s", runs[len(runs)-1].ID)
	}
}

func TestDeleteTaskRemovesAllRuns(t *testing.T) {
	store := newStore(t)
	run := sampleRun("run-1", time.Now().UTC())
	other := sampleRun("run-2", time.Now().UTC())
	other.TaskID = "task-2"
	for _, r := range []Run{run, other} {
		if err := store.Start(r); err != nil {
			t.Fatal(err)
		}
	}
	if err := store.DeleteTask("task-1"); err != nil {
		t.Fatal(err)
	}
	if _, total, _ := store.List("task-1", 0, 0); total != 0 {
		t.Fatalf("task-1 runs should be gone: %d", total)
	}
	if _, total, _ := store.List("task-2", 0, 0); total != 1 {
		t.Fatalf("task-2 runs must survive: %d", total)
	}
}

func TestReopenRepairsInterruptedRuns(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "history.db")
	store, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	run := sampleRun("run-1", time.Now().UTC())
	if err := store.Start(run); err != nil {
		t.Fatal(err)
	}
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = reopened.Close() }()
	runs, total, err := reopened.List("task-1", 0, 0)
	if err != nil || total != 1 {
		t.Fatalf("reopen lost the record: %d %v", total, err)
	}
	if runs[0].Status != StatusInterrupted || runs[0].FinishedAt == nil || runs[0].Error == "" {
		t.Fatalf("expected interrupted repair: %+v", runs[0])
	}
}

func TestNilStoreIsSafeNoOp(t *testing.T) {
	var store *Store
	run := sampleRun("run-1", time.Now().UTC())
	if err := store.Start(run); err != nil {
		t.Fatal(err)
	}
	if err := store.Finish(finishInput(run, StatusSucceeded, run.StartedAt, run.StartedAt)); err != nil {
		t.Fatal(err)
	}
	if err := store.DeleteTask("task-1"); err != nil {
		t.Fatal(err)
	}
	if err := store.Close(); err != nil {
		t.Fatal(err)
	}
	runs, total, err := store.List("task-1", 0, 0)
	if err != nil || total != 0 || len(runs) != 0 {
		t.Fatalf("nil store should return empty: %d %d %v", total, len(runs), err)
	}
	latest, err := store.LatestByTask()
	if err != nil || len(latest) != 0 {
		t.Fatalf("nil store latest should be empty: %d %v", len(latest), err)
	}
}

func fmtRun(i int) string {
	return "run-" + string(rune('a'+i))
}
