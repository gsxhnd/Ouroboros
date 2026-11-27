package service

import "github.com/gsxhnd/ourboros/internal/mounts"

type Mounts struct{ serviceBase }

func (s *Mounts) List() []mounts.Snapshot {
	return s.state.Mounts.List()
}

func (s *Mounts) Start(edgeID string) (mounts.Snapshot, error) {
	return s.state.Mounts.Start(edgeID)
}

func (s *Mounts) Stop(edgeID string) (mounts.Snapshot, error) {
	return s.state.Mounts.Stop(edgeID)
}
