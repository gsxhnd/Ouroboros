package service

import (
	"context"

	"github.com/gsxhnd/ourboros/internal/mounts"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

type Mounts struct{ serviceBase }

func (s *Mounts) List() []mounts.Snapshot {
	return s.state.Mounts.List()
}

func (s *Mounts) ListTasks() ([]workspace.Mount, uint64) {
	return s.state.Workspace.ListMounts()
}

func (s *Mounts) Create(ctx context.Context, body workspace.CreateMount) (workspace.Mount, workspace.Document, error) {
	remotes, known, err := s.remotesIfReady(ctx)
	if err != nil {
		return workspace.Mount{}, workspace.Document{}, err
	}
	return s.state.Workspace.CreateMount(body, remotes, known)
}

func (s *Mounts) Delete(id string, revision uint64) (workspace.Document, error) {
	if err := s.ensureIdle([]string{id}); err != nil {
		return workspace.Document{}, err
	}
	return s.state.Workspace.DeleteMount(id, revision)
}

func (s *Mounts) Start(edgeID string) (mounts.Snapshot, error) {
	return s.state.Mounts.Start(edgeID)
}

func (s *Mounts) Stop(edgeID string) (mounts.Snapshot, error) {
	return s.state.Mounts.Stop(edgeID)
}
