package service

import (
	"context"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/jobs"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

type SyncTasks struct{ serviceBase }

func (s *SyncTasks) List() ([]workspace.SyncTask, uint64) {
	return s.state.Workspace.SyncTasks()
}

func (s *SyncTasks) Create(ctx context.Context, body workspace.CreateSyncTask) (workspace.SyncTask, workspace.Document, error) {
	remotes, known, err := s.remotesIfReady(ctx)
	if err != nil {
		return workspace.SyncTask{}, workspace.Document{}, err
	}
	return s.state.Workspace.CreateSyncTask(body, remotes, known)
}

func (s *SyncTasks) Patch(ctx context.Context, id string, body workspace.PatchSyncTask) (workspace.SyncTask, workspace.Document, error) {
	remotes, known, err := s.remotesIfReady(ctx)
	if err != nil {
		return workspace.SyncTask{}, workspace.Document{}, err
	}
	return s.state.Workspace.PatchSyncTask(id, body, remotes, known)
}

func (s *SyncTasks) Delete(id string, revision uint64) (workspace.Document, error) {
	if err := s.ensureIdle([]string{id}); err != nil {
		return workspace.Document{}, err
	}
	return s.state.Workspace.DeleteSyncTask(id, revision)
}

// Run validates the saved task and starts it with its persisted limits. A
// two-way sync must establish its baseline with an explicit initial resync.
func (s *SyncTasks) Run(_ context.Context, taskID string, resync bool) (jobs.Snapshot, error) {
	doc := s.state.Workspace.Get()
	edge := doc.Edge(taskID)
	if edge == nil {
		return jobs.Snapshot{}, core.NotFound("sync task " + taskID)
	}
	if edge.Kind != workspace.EdgeSync {
		return jobs.Snapshot{}, invalidRequest("only sync tasks can be run")
	}
	if edge.Sync == nil {
		return jobs.Snapshot{}, invalidRequest("sync task is missing configuration")
	}
	if !edge.Sync.Enabled {
		return jobs.Snapshot{}, core.ConflictDetail("sync task is disabled", map[string]any{})
	}
	if edge.Sync.Operation.TwoWay() && edge.Sync.LastResult == nil && !resync {
		return jobs.Snapshot{}, core.ConflictDetail("two-way sync requires an initial resync run", map[string]any{"kind": "bisync_resync_required"})
	}
	source, err := doc.NodeLocator(edge.Source, s.state.HomeDir)
	if err != nil {
		return jobs.Snapshot{}, err
	}
	target, err := doc.NodeLocator(edge.Target, s.state.HomeDir)
	if err != nil {
		return jobs.Snapshot{}, err
	}
	return s.state.Jobs.Start(taskID, edge.Sync.Operation, source, target, jobs.Options{
		BWLimit:     edge.Sync.BWLimit,
		MaxTransfer: edge.Sync.MaxTransfer,
		Resync:      resync,
	})
}

func (s *SyncTasks) ListJobs() []jobs.Snapshot {
	return s.state.Jobs.List()
}

func (s *SyncTasks) StopJob(jobID string) (jobs.Snapshot, error) {
	return s.state.Jobs.Stop(jobID)
}
