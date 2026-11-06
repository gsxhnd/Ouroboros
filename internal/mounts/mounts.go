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
	if !waitRunning(spawned, mountStartGrace, mountStartStep) {
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

const (
	// mountStartGrace is the settle window a mount process gets before we
	// declare it mounted. One that exits inside the window is reported as
	// failed with its buffered stderr; one that survives is treated healthy
	// and handed to watch.
	mountStartGrace = 400 * time.Millisecond
	mountStartStep  = 25 * time.Millisecond
)

// waitRunning reports whether the mount process is still alive after the
// settle window. It returns as soon as the process exits, so a mount that
// fails fast (bad remote, bad mount point) surfaces in tens of milliseconds
// instead of always paying the whole grace period.
func waitRunning(spawned *rclone.SpawnedMount, grace, step time.Duration) bool {
	deadline := time.Now().Add(grace)
	for {
		if spawned.Exited() {
			return false
		}
		if !time.Now().Before(deadline) {
			return true
		}
		time.Sleep(step)
	}
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

// watchInterval is the fallback pace of the mount watcher. The primary signal
// is the process exit channel; the interval only re-checks liveness in case
// the channel is missed (for example when Stop ran concurrently).
const watchInterval = 750 * time.Millisecond

func (s *Supervisor) watch(edgeID string) {
	for {
		s.mu.Lock()
		item, ok := s.items[edgeID]
		if !ok || item.snapshot.Status != StatusMounted || item.spawn == nil {
			s.mu.Unlock()
			return
		}
		spawn := item.spawn
		exited := spawn.Done()
		s.mu.Unlock()

		select {
		case <-exited:
			// 进程已退出，确认仍是当前 mount 的进程且未被 Stop 抢先处理。
			s.mu.Lock()
			item, ok := s.items[edgeID]
			stillMounted := ok && item.spawn == spawn && item.snapshot.Status == StatusMounted
			if stillMounted {
				item.snapshot.Status = StatusFailed
				item.snapshot.ExitCode = spawn.ExitCode()
				message := "rclone mount exited unexpectedly"
				item.snapshot.Error = &message
				item.spawn = nil
				snapshot := item.snapshot
				s.mu.Unlock()
				s.emit(snapshot)
				return
			}
			s.mu.Unlock()
			return
		case <-time.After(watchInterval):
			// fallback 轮询：Alive 则回到循环重新取最新的状态与进程句柄。
		}
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
