package service

import (
	"context"

	"github.com/gsxhnd/ourboros/internal/rclone"
)

type RCProxy struct{ serviceBase }

func (s *RCProxy) Call(ctx context.Context, command string, payload map[string]any) (rclone.Response, error) {
	return s.state.Rclone.CallAllowed(ctx, command, payload)
}
