package app

import (
	"log/slog"

	"github.com/gsxhnd/ourboros/internal/jobs"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

// recordJobResult returns the callback that stores a finished job's outcome on
// its sync task, which is what the task list shows as "last result".
func recordJobResult(ws *workspace.Store) jobs.FinishFunc {
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
	}
}
