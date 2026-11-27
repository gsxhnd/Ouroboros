package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

func TestSyncTaskCreationDegradesWhenRcloneIsNotRunning(t *testing.T) {
	ctx, _, svcs, local := newTestServices(t)
	task := createServiceTask(t, ctx, svcs, local, "backup", workspace.OpSync)
	if task.Target.Remote != "archive" {
		t.Fatalf("remote endpoint was rejected while rclone availability was unknown: %+v", task)
	}
}

func TestSyncTaskRunGuards(t *testing.T) {
	ctx, _, svcs, local := newTestServices(t)
	bisync := createServiceTask(t, ctx, svcs, local, "mirror", workspace.OpBisync)

	err := func() error {
		_, err := svcs.SyncTasks.Run(ctx, bisync.ID, false)
		return err
	}()
	coreErr := requireCoreKind(t, err, core.KindConflict)
	if coreErr.Detail("kind") != "bisync_resync_required" {
		t.Fatalf("bisync guard details = %v", coreErr.Details)
	}
	if _, err := svcs.SyncTasks.Run(ctx, bisync.ID, true); err == nil {
		t.Fatal("an explicit resync should pass the guard and reach rclone")
	} else {
		requireCoreKind(t, err, core.KindNotRunning)
	}

	oneWay := createServiceTask(t, ctx, svcs, local, "one-way", workspace.OpSync)
	disabled := false
	if _, _, err := svcs.SyncTasks.Patch(ctx, oneWay.ID, workspace.PatchSyncTask{
		Revision: svcs.Workspace.Get().Revision,
		Enabled:  &disabled,
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := svcs.SyncTasks.Run(ctx, oneWay.ID, false); err == nil {
		t.Fatal("disabled task was run")
	} else {
		requireCoreKind(t, err, core.KindConflict)
	}
}

func TestRunningSyncTaskCannotBeDeleted(t *testing.T) {
	ctx, state, svcs, local := newTestServices(t)
	var finished atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		reply := map[string]any{}
		switch r.URL.Path {
		case "/core/version":
			reply["version"] = "v1.70.0"
		case "/config/listremotes":
			reply["remotes"] = []any{"archive"}
		case "/sync/sync":
			reply["jobid"] = 11
		case "/job/status":
			reply["finished"] = finished.Load()
			reply["success"] = true
		case "/job/stop":
			finished.Store(true)
		}
		_ = json.NewEncoder(w).Encode(reply)
	}))
	defer server.Close()
	state.Rclone.UpdateSettings(func(settings *rclone.Settings) { settings.RCURL = server.URL })
	if _, err := state.Rclone.Start(ctx); err != nil {
		t.Fatalf("attach fake RC: %v", err)
	}

	task := createServiceTask(t, ctx, svcs, local, "running", workspace.OpSync)
	snapshot, err := svcs.SyncTasks.Run(ctx, task.ID, false)
	if err != nil {
		t.Fatalf("run: %v", err)
	}
	defer func() {
		_, _ = svcs.SyncTasks.StopJob(snapshot.ID)
	}()
	if _, err := svcs.SyncTasks.Delete(task.ID, svcs.Workspace.Get().Revision); err == nil {
		t.Fatal("running task was deleted")
	} else {
		requireCoreKind(t, err, core.KindConflict)
	}
	if tasks, _ := svcs.SyncTasks.List(); len(tasks) != 1 {
		t.Fatalf("task disappeared after rejected deletion: %v", tasks)
	}
}

func TestRemoteReferencedByTaskCannotBeDeleted(t *testing.T) {
	ctx, _, svcs, local := newTestServices(t)
	createServiceTask(t, ctx, svcs, local, "backup", workspace.OpSync)
	err := svcs.Remotes.Delete(context.Background(), "archive")
	coreErr := requireCoreKind(t, err, core.KindConflict)
	if coreErr.Detail("kind") != "remote_in_use" {
		t.Fatalf("delete error details = %v", coreErr.Details)
	}
}
