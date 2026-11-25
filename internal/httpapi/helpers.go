package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/rclone"
)

func (a *api) remotesIfReady(ctx context.Context) ([]string, bool, error) {
	remotes, err := a.state.Rclone.ListRemotes(ctx)
	if err == nil {
		return remotes, true, nil
	}
	var coreErr *core.Error
	if errors.As(err, &coreErr) && coreErr.Kind == core.KindNotRunning {
		return nil, false, nil
	}
	return nil, false, err
}

func (a *api) ensureIdle(edgeIDs []string) error {
	for _, edgeID := range edgeIDs {
		if a.state.Jobs.IsRunning(edgeID) {
			return core.Conflict("edge " + edgeID + " has a running job")
		}
		if a.state.Mounts.IsActive(edgeID) {
			return core.Conflict("edge " + edgeID + " has an active mount")
		}
	}
	return nil
}

func revisionQuery(r *http.Request) (uint64, error) {
	raw := r.URL.Query().Get("revision")
	if raw == "" {
		return 0, core.InvalidRequest("revision is required")
	}
	value, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return 0, core.InvalidRequest("revision is invalid")
	}
	return value, nil
}

func mapUpstream(response rclone.Response) error {
	return response.Err("rclone operation failed")
}
