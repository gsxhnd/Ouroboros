package service

import (
	"context"
	"log/slog"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/history"
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
	doc, err := s.state.Workspace.DeleteSyncTask(id, revision)
	if err != nil {
		return workspace.Document{}, err
	}
	// 任务没了，它的执行历史也一并清掉；失败不影响删除本身。
	if err := s.state.History.DeleteTask(id); err != nil {
		slog.Warn("could not delete run history", "task", id, "err", err)
	}
	return doc, nil
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
		return jobs.Snapshot{}, core.ConflictDetailExact("sync task is disabled", map[string]any{})
	}
	if edge.Sync.Operation.TwoWay() && edge.Sync.LastResult == nil && !resync {
		return jobs.Snapshot{}, core.ConflictDetailExact("two-way sync requires an initial resync run", map[string]any{"kind": "bisync_resync_required"})
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
		Trigger:     jobs.TriggerManual,
	})
}

func (s *SyncTasks) ListJobs() []jobs.Snapshot {
	return s.state.Jobs.List()
}

func (s *SyncTasks) StopJob(jobID string) (jobs.Snapshot, error) {
	return s.state.Jobs.Stop(jobID)
}

// syncTaskExists 校验任务存在且是同步任务；历史记录只属于同步任务。
func (s *SyncTasks) syncTaskExists(taskID string) error {
	doc := s.state.Workspace.Get()
	edge := doc.Edge(taskID)
	if edge == nil || edge.Kind != workspace.EdgeSync {
		return core.NotFound("sync task " + taskID)
	}
	return nil
}

// ListRuns 返回任务的执行记录（最新在前，分页），total 为记录总数。
func (s *SyncTasks) ListRuns(taskID string, limit, offset int) ([]history.Run, int, error) {
	if err := s.syncTaskExists(taskID); err != nil {
		return nil, 0, err
	}
	return s.state.History.List(taskID, limit, offset)
}

// LatestRuns 返回每个任务最近一次执行的记录（任务页概览用）。
func (s *SyncTasks) LatestRuns() ([]history.Run, error) {
	return s.state.History.LatestByTask()
}
