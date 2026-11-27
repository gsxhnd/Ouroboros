package service

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/gsxhnd/ourboros/internal/app"
	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/paths"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

func newTestServices(t *testing.T) (context.Context, *app.State, *Services, string) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	dir := t.TempDir()
	local := filepath.Join(dir, "local")
	if err := os.MkdirAll(local, 0o755); err != nil {
		t.Fatal(err)
	}
	state, err := app.New(ctx, app.Config{
		DataDir:   dir,
		RcloneBin: filepath.Join(dir, "missing-rclone"),
	})
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	t.Cleanup(state.Close)
	t.Cleanup(cancel)
	return ctx, state, New(state), local
}

func createServiceTask(t *testing.T, ctx context.Context, svcs *Services, local, name string, operation workspace.Operation) workspace.SyncTask {
	t.Helper()
	revision := svcs.Workspace.Get().Revision
	task, _, err := svcs.SyncTasks.Create(ctx, workspace.CreateSyncTask{
		Revision:  revision,
		Name:      name,
		Operation: operation,
		Source:    workspace.TaskEndpoint{Kind: paths.KindLocal, Path: local},
		Target:    workspace.TaskEndpoint{Kind: paths.KindRemote, Remote: "archive", Path: "docs"},
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}
	return task
}

func requireCoreKind(t *testing.T, err error, kind core.Kind) *core.Error {
	t.Helper()
	if err == nil {
		t.Fatalf("expected core error kind %v, got nil", kind)
	}
	coreErr, ok := err.(*core.Error)
	if !ok || coreErr.Kind != kind {
		t.Fatalf("error = %#v, want core kind %v", err, kind)
	}
	return coreErr
}
