package rclone

import (
	"context"
)

func (s *Supervisor) ListRemotes(ctx context.Context) ([]string, error) {
	res, err := s.CallInternal(ctx, "config/listremotes", map[string]any{})
	if err != nil {
		return nil, err
	}
	if err := res.Err("rclone rc returned an error"); err != nil {
		return nil, err
	}
	raw, ok := res.Body["remotes"].([]any)
	if !ok {
		return []string{}, nil
	}
	names := make([]string, 0, len(raw))
	for _, item := range raw {
		if name, ok := item.(string); ok {
			names = append(names, name)
		}
	}
	return names, nil
}
