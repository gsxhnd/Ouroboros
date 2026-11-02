package mounts

import (
	"sync"
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

type Status string

const (
	StatusStarting Status = "starting"
	StatusMounted  Status = "mounted"
	StatusStopping Status = "stopping"
	StatusStopped  Status = "stopped"
	StatusFailed   Status = "failed"
)

type Snapshot struct {
	EdgeID   string  `json:"edge_id"`
	Status   Status  `json:"status"`
	Source   string  `json:"source"`
	Target   string  `json:"target"`
	ExitCode *int    `json:"exit_code,omitempty"`
	Error    *string `json:"error,omitempty"`
}

type mountInstance struct {
	snapshot  Snapshot
	spawn     *rclone.SpawnedMount
	localPath string
}

type Supervisor struct {
	mu     sync.Mutex
	items  map[string]*mountInstance
	events *events.Bus
}

func New(bus *events.Bus) *Supervisor {
	return &Supervisor{items: map[string]*mountInstance{}, events: bus}
}

func (s *Supervisor) List(ws *workspace.Store) []Snapshot {
	doc := ws.Get()
	s.mu.Lock()
	defer s.mu.Unlock()
	mounts := []Snapshot{}
	for _, edge := range doc.Edges {
		if edge.Kind != workspace.EdgeMount {
			continue
		}
		if item, ok := s.items[edge.ID]; ok {
			mounts = append(mounts, item.snapshot)
			continue
		}
		mounts = append(mounts, Snapshot{
			EdgeID: edge.ID,
			Status: StatusStopped,
			Source: edge.Source,
			Target: edge.Target,
		})
	}
	return mounts
}

func (s *Supervisor) IsActive(edgeID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	item, ok := s.items[edgeID]
	if !ok {
		return false
	}
	switch item.snapshot.Status {
	case StatusStarting, StatusMounted, StatusStopping:
		return true
	default:
		return false
	}
}

func (s *Supervisor) Start(rc *rclone.Supervisor, ws *workspace.Store, edgeID string) (Snapshot, error) {
	doc := ws.Get()
	edge := doc.Edge(edgeID)
	if edge == nil {
		return Snapshot{}, core.NotFound("edge " + edgeID)
	}
	if edge.Kind != workspace.EdgeMount {
		return Snapshot{}, core.InvalidRequest("edge " + edgeID + " is not a mount edge")
	}
	sourceNode := doc.Node(edge.Source)
	if sourceNode == nil {
		return Snapshot{}, core.NotFound("node " + edge.Source)
	}
	targetNode := doc.Node(edge.Target)
	if targetNode == nil {
		return Snapshot{}, core.NotFound("node " + edge.Target)
	}
	if sourceNode.Kind != workspace.NodeRemote || targetNode.Kind != workspace.NodeLocal {
		return Snapshot{}, core.InvalidRequest("mount edges must go from a remote source to a local target")
	}
	home := ws.Home()
	source, err := sourceNode.Locator(home)
	if err != nil {
		return Snapshot{}, err
	}
	target, err := targetNode.Locator(home)
	if err != nil {
		return Snapshot{}, err
	}
	s.mu.Lock()
	if item, ok := s.items[edgeID]; ok && (item.snapshot.Status == StatusStarting || item.snapshot.Status == StatusMounted) {
		s.mu.Unlock()
		return Snapshot{}, core.Conflict("edge " + edgeID + " is already mounted")
	}
	snapshot := Snapshot{
		EdgeID: edgeID,
		Status: StatusStarting,
		Source: source.Display(),
		Target: target.Display(),
	}
	s.items[edgeID] = &mountInstance{snapshot: snapshot, localPath: target.FS}
	s.mu.Unlock()
	s.emit(snapshot)

	spawned, err := rclone.SpawnMount(rc.Settings(), source, target.FS, nil)
	if err != nil {
		failed := snapshot
		failed.Status = StatusFailed
		message := err.Error()
		failed.Error = &message
		s.store(edgeID, failed, nil, target.FS)
		s.emit(failed)
		return Snapshot{}, err
	}
	time.Sleep(400 * time.Millisecond)
	if spawned.Exited() {
		message := rclone.DrainStderr(spawned.Stderr)
		if message == "" {
			message = "rclone mount exited immediately"
		}
		failed := snapshot
		failed.Status = StatusFailed
		failed.ExitCode = spawned.ExitCode()
		failed.Error = &message
		s.store(edgeID, failed, nil, target.FS)
		s.emit(failed)
		return failed, nil
	}
	mounted := snapshot
	mounted.Status = StatusMounted
	s.store(edgeID, mounted, spawned, target.FS)
	s.emit(mounted)
	go s.watch(edgeID)
	return mounted, nil
}

func (s *Supervisor) Stop(edgeID string) (Snapshot, error) {
	s.mu.Lock()
	item, ok := s.items[edgeID]
	if !ok {
		s.mu.Unlock()
		return Snapshot{}, core.NotFound("mount " + edgeID)
	}
	item.snapshot.Status = StatusStopping
	spawn := item.spawn
	s.mu.Unlock()
	if spawn != nil {
		spawn.Stop()
	}
	s.mu.Lock()
	item.snapshot.Status = StatusStopped
	if spawn != nil {
		item.snapshot.ExitCode = spawn.ExitCode()
	}
	item.snapshot.Error = nil
	item.spawn = nil
	snapshot := item.snapshot
	s.mu.Unlock()
	s.emit(snapshot)
	return snapshot, nil
}

// StopAll unmounts every mount that currently has a live rclone process. It is
// called on shutdown so rclone mount children never outlive Ourboros.
func (s *Supervisor) StopAll() {
	s.mu.Lock()
	active := make([]string, 0, len(s.items))
	for edgeID, item := range s.items {
		if item.spawn != nil {
			active = append(active, edgeID)
		}
	}
	s.mu.Unlock()
	for _, edgeID := range active {
		_, _ = s.Stop(edgeID)
	}
}

func (s *Supervisor) watch(edgeID string) {
	for {
		time.Sleep(750 * time.Millisecond)
		s.mu.Lock()
		item, ok := s.items[edgeID]
		if !ok || item.snapshot.Status != StatusMounted || item.spawn == nil {
			s.mu.Unlock()
			return
		}
		if !item.spawn.Exited() {
			s.mu.Unlock()
			continue
		}
		item.snapshot.Status = StatusFailed
		item.snapshot.ExitCode = item.spawn.ExitCode()
		message := "rclone mount exited unexpectedly"
		item.snapshot.Error = &message
		item.spawn = nil
		snapshot := item.snapshot
		s.mu.Unlock()
		s.emit(snapshot)
		return
	}
}

func (s *Supervisor) store(edgeID string, snapshot Snapshot, spawn *rclone.SpawnedMount, localPath string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[edgeID] = &mountInstance{snapshot: snapshot, spawn: spawn, localPath: localPath}
}

func (s *Supervisor) emit(snapshot Snapshot) {
	if s.events != nil {
		s.events.Publish("mount", snapshot)
	}
}
