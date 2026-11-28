package app

import (
	"log/slog"
	"time"

	"github.com/gsxhnd/ourboros/internal/history"
	"github.com/gsxhnd/ourboros/internal/jobs"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

// recordJobStart returns the callback that writes a run's opening record into
// the bbolt history. It fires before the rclone call, so a start that fails
// immediately (rclone offline) is still recorded once finish() fires.
func recordJobStart(hist *history.Store) jobs.StartFunc {
	return func(snapshot jobs.Snapshot) {
		err := hist.Start(history.Run{
			ID:        snapshot.ID,
			TaskID:    snapshot.EdgeID,
			Operation: string(snapshot.Operation),
			Source: history.Locator{
				Kind:   string(snapshot.Source.Kind),
				FS:     snapshot.Source.FS,
				Remote: snapshot.Source.Remote,
			},
			Target: history.Locator{
				Kind:   string(snapshot.Target.Kind),
				FS:     snapshot.Target.FS,
				Remote: snapshot.Target.Remote,
			},
			Trigger:   string(snapshot.Trigger),
			Status:    history.StatusRunning,
			StartedAt: snapshot.StartedAt,
		})
		if err != nil {
			slog.Warn("could not record run start", "job", snapshot.ID, "err", err)
		}
	}
}

// recordJobResult returns the callback that stores a finished job's outcome on
// its sync task (the "last result" the task list shows) and finalizes its run
// record in the bbolt history.
func recordJobResult(ws *workspace.Store, hist *history.Store) jobs.FinishFunc {
	return func(edgeID string, snapshot jobs.Snapshot) {
		_, err := ws.RecordJobResult(edgeID, workspace.LastResult{
			JobID:      snapshot.ID,
			Status:     string(snapshot.Status),
			FinishedAt: snapshot.FinishedAt,
			Error:      snapshot.Error,
		}, nil)
		if err != nil {
			slog.Warn("could not record job result", "edge", edgeID, "job", snapshot.ID, "err", err)
		}
		finishHistory(hist, edgeID, snapshot)
	}
}

// finishHistory 把终态快照写进执行历史；历史库不可用时静默跳过。
func finishHistory(hist *history.Store, edgeID string, snapshot jobs.Snapshot) {
	finishedAt := time.Now().UTC()
	if snapshot.FinishedAt != nil {
		finishedAt = *snapshot.FinishedAt
	}
	err := hist.Finish(history.FinishInput{
		TaskID:     edgeID,
		RunID:      snapshot.ID,
		StartedAt:  snapshot.StartedAt,
		Status:     string(snapshot.Status),
		Error:      errorMessage(snapshot.Error),
		FinishedAt: finishedAt,
		Stats: &history.RunStats{
			Bytes:      snapshot.Progress.Bytes,
			Transfers:  snapshot.Progress.Transfers,
			Checks:     snapshot.Progress.Checks,
			Errors:     snapshot.Progress.Errors,
			Percentage: snapshot.Progress.Percentage,
			Speed:      snapshot.Progress.Speed,
		},
	})
	if err != nil {
		slog.Warn("could not record run finish", "job", snapshot.ID, "err", err)
	}
}

func errorMessage(err *string) string {
	if err == nil {
		return ""
	}
	return *err
}
