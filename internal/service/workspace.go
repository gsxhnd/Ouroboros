package service

import (
	"context"

	"github.com/gsxhnd/ourboros/internal/workspace"
)

type Workspace struct{ serviceBase }

func (s *Workspace) Get() workspace.Document {
	return s.state.Workspace.Get()
}

func (s *Workspace) CreateNode(ctx context.Context, body workspace.CreateNode) (workspace.Document, error) {
	remotes, known, err := s.remotesIfReady(ctx)
	if err != nil {
		return workspace.Document{}, err
	}
	return s.state.Workspace.CreateNode(body, remotes, known)
}

func (s *Workspace) DeleteNode(ctx context.Context, id string, revision uint64) (workspace.Document, error) {
	remotes, known, err := s.remotesIfReady(ctx)
	if err != nil {
		return workspace.Document{}, err
	}
	return s.state.Workspace.DeleteNode(id, revision, remotes, known)
}
