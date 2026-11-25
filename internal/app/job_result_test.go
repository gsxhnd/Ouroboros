package app

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gsxhnd/ourboros/internal/jobs"
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
	recordJobResult(ws)(task.ID, jobs.Snapshot{
		ID: "job-1", Status: jobs.StatusFailed, FinishedAt: &finished, Error: &message,
	})

	tasks, _ := ws.SyncTasks()
	last := tasks[0].LastResult
	if last == nil || last.JobID != "job-1" || last.Status != string(jobs.StatusFailed) ||
		last.Error == nil || *last.Error != "boom" {
		t.Fatalf("last result = %+v", last)
	}
}

func TestRecordJobResultIgnoresUnknownTask(t *testing.T) {
	ws, err := workspace.LoadOrCreate(filepath.Join(t.TempDir(), "workspace.json"), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	// A task deleted while its job was running must not panic or corrupt state.
	recordJobResult(ws)("gone", jobs.Snapshot{ID: "job-1", Status: jobs.StatusSucceeded})
}
