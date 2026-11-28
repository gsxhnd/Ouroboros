package app

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gsxhnd/ourboros/internal/history"
	"github.com/gsxhnd/ourboros/internal/jobs"
	"github.com/gsxhnd/ourboros/internal/paths"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

func TestRecordJobResultStoresOutcomeOnTheTask(t *testing.T) {
	dir := t.TempDir()
	local := filepath.Join(dir, "src")
	target := filepath.Join(dir, "dst")
	for _, p := range []string{local, target} {
		if err := os.MkdirAll(p, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	ws, err := workspace.LoadOrCreate(filepath.Join(dir, "workspace.json"), dir)
	if err != nil {
		t.Fatal(err)
	}
	task, _, err := ws.CreateSyncTask(workspace.CreateSyncTask{
		Name:      "t",
		Operation: workspace.OpCopy,
		Source:    workspace.TaskEndpoint{Kind: "local", Path: local},
		Target:    workspace.TaskEndpoint{Kind: "local", Path: target},
	}, nil, false)
	if err != nil {
		t.Fatal(err)
	}

	finished := time.Now().UTC()
	message := "boom"
	hist, err := history.Open(filepath.Join(dir, "history.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = hist.Close() }()
	started := finished.Add(-time.Minute)
	recordJobStart(hist)(jobs.Snapshot{
		ID: "job-1", EdgeID: task.ID, Operation: workspace.OpCopy,
		Status: jobs.StatusRunning, Trigger: jobs.TriggerManual, StartedAt: started,
		Source: paths.Locator{Kind: paths.KindLocal, FS: local},
	})
	recordJobResult(ws, hist)(task.ID, jobs.Snapshot{
		ID: "job-1", Status: jobs.StatusFailed, FinishedAt: &finished,
		Error: &message, StartedAt: started,
		Progress: jobs.Progress{Bytes: 2048, Transfers: 2},
	})

	tasks, _ := ws.SyncTasks()
	last := tasks[0].LastResult
	if last == nil || last.JobID != "job-1" || last.Status != string(jobs.StatusFailed) ||
		last.Error == nil || *last.Error != "boom" {
		t.Fatalf("last result = %+v", last)
	}

	runs, total, err := hist.List(task.ID, 0, 0)
	if err != nil || total != 1 {
		t.Fatalf("history should hold one run: %d %v", total, err)
	}
	if runs[0].Status != string(jobs.StatusFailed) || runs[0].Error != "boom" {
		t.Fatalf("run = %+v", runs[0])
	}
	if runs[0].Stats == nil || runs[0].Stats.Bytes != 2048 {
		t.Fatalf("run stats = %+v", runs[0].Stats)
	}
}

func TestRecordJobResultIgnoresUnknownTask(t *testing.T) {
	ws, err := workspace.LoadOrCreate(filepath.Join(t.TempDir(), "workspace.json"), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	// A task deleted while its job was running must not panic or corrupt state.
	recordJobResult(ws, nil)("gone", jobs.Snapshot{ID: "job-1", Status: jobs.StatusSucceeded})
}

func TestRecordJobStartWritesRunningRecord(t *testing.T) {
	hist, err := history.Open(filepath.Join(t.TempDir(), "history.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = hist.Close() }()
	started := time.Now().UTC()
	recordJobStart(hist)(jobs.Snapshot{
		ID: "job-1", EdgeID: "task-1", Operation: workspace.OpCopy,
		Status: jobs.StatusRunning, Trigger: jobs.TriggerManual,
		StartedAt: started,
		Source:    paths.Locator{Kind: paths.KindLocal, FS: "/tmp/src"},
	})
	runs, total, err := hist.List("task-1", 0, 0)
	if err != nil || total != 1 {
		t.Fatalf("start should record a run: %d %v", total, err)
	}
	if runs[0].Status != history.StatusRunning || runs[0].Trigger != string(jobs.TriggerManual) {
		t.Fatalf("run = %+v", runs[0])
	}
}

// 未显式指定 HistoryPath 时，历史库默认落在数据目录下，与 workspace/settings 同住。
func TestAppOpensHistoryInDataDir(t *testing.T) {
	dir := t.TempDir()
	state, err := New(context.Background(), Config{DataDir: dir})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { state.Close() })
	if state.History == nil {
		t.Fatal("history store should open by default under the data dir")
	}
	if _, err := os.Stat(filepath.Join(dir, "ourboros.db")); err != nil {
		t.Fatalf("history db file missing: %v", err)
	}
	if err := state.History.Start(history.Run{
		ID: "run-1", TaskID: "task-1", Status: history.StatusRunning,
		StartedAt: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("history store should be writable: %v", err)
	}
}
