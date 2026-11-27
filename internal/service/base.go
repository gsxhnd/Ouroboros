package service

import (
	"context"
	"errors"

	"github.com/gsxhnd/ourboros/internal/app"
	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/rclone"
)

type serviceBase struct {
	state *app.State
}

func (b *serviceBase) remotesIfReady(ctx context.Context) ([]string, bool, error) {
	remotes, err := b.state.Rclone.ListRemotes(ctx)
	if err == nil {
		return remotes, true, nil
	}
	var coreErr *core.Error
	if errors.As(err, &coreErr) && coreErr.Kind == core.KindNotRunning {
		return nil, false, nil
	}
	return nil, false, err
}

func (b *serviceBase) ensureIdle(edgeIDs []string) error {
	for _, edgeID := range edgeIDs {
		if b.state.Jobs.IsRunning(edgeID) {
			return core.Conflict("edge " + edgeID + " has a running job")
		}
		if b.state.Mounts.IsActive(edgeID) {
			return core.Conflict("edge " + edgeID + " has an active mount")
		}
	}
	return nil
}

func mapUpstream(response rclone.Response) error {
	return response.Err("rclone operation failed")
}

// invalidRequest preserves the message text of validations that used to live
// in HTTP handlers. Domain validation keeps using core.InvalidRequest, whose
// message includes its own prefix.
func invalidRequest(message string) *core.Error {
	return &core.Error{Kind: core.KindInvalidRequest, Message: message}
}
