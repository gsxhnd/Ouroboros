package workspace

import (
	"encoding/json"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/paths"
	"github.com/gsxhnd/ourboros/internal/persist"
)

const SchemaVersion = 1

type Document struct {
	SchemaVersion uint32    `json:"schema_version"`
	Revision      uint64    `json:"revision"`
	Nodes         []Node    `json:"nodes"`
	Edges         []Edge    `json:"edges"`
	Viewport      Viewport  `json:"viewport"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func EmptyDocument() Document {
	return Document{
		SchemaVersion: SchemaVersion,
		Nodes:         []Node{},
		Edges:         []Edge{},
		Viewport:      Viewport{Zoom: 1},
		UpdatedAt:     time.Now().UTC(),
	}
}

func (d Document) Node(id string) *Node {
	for i := range d.Nodes {
		if d.Nodes[i].ID == id {
			return &d.Nodes[i]
		}
	}
	return nil
}

func (d Document) Edge(id string) *Edge {
	for i := range d.Edges {
		if d.Edges[i].ID == id {
			return &d.Edges[i]
		}
	}
	return nil
}

func (d Document) NodeLocator(id, home string) (paths.Locator, error) {
	node := d.Node(id)
	if node == nil {
		return paths.Locator{}, core.NotFound("node " + id)
	}
	return node.Locator(home)
}

type Node struct {
	ID        string   `json:"id"`
	Kind      NodeKind `json:"kind"`
	Label     string   `json:"label"`
	Position  Position `json:"position"`
	LocalPath *string  `json:"local_path,omitempty"`
	Remote    *Remote  `json:"remote,omitempty"`
	Action    *Action  `json:"action,omitempty"`
}

// Action 是画布上的中间处理节点：它接收上游存储节点的数据，按自身的操作写入下游存储节点。
type Action struct {
	Operation  Operation   `json:"operation"`
	Schedule   Schedule    `json:"schedule"`
	Enabled    bool        `json:"enabled"`
	NextRun    *time.Time  `json:"next_run,omitempty"`
	LastResult *LastResult `json:"last_result,omitempty"`
}

func (n Node) Locator(home string) (paths.Locator, error) {
	switch n.Kind {
	case NodeAction:
		return paths.Locator{}, core.InvalidRequest("action node " + n.ID + " has no storage location")
	case NodeLocal:
		if n.LocalPath == nil {
			return paths.Locator{}, core.InvalidPath("local node " + n.ID + " is missing local_path")
		}
		return paths.Parse(*n.LocalPath, "", home)
	case NodeRemote:
		if n.Remote == nil {
			return paths.Locator{}, core.InvalidPath("remote node " + n.ID + " is missing remote")
		}
		return paths.Parse(n.Remote.Name, n.Remote.Path, home)
	default:
		return paths.Locator{}, core.InvalidRequest("unknown node kind")
	}
}

type NodeKind string

const (
	NodeLocal  NodeKind = "local"
	NodeRemote NodeKind = "remote"
	NodeAction NodeKind = "action"
)

type Remote struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type Viewport struct {
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Zoom float64 `json:"zoom"`
}

type Edge struct {
	ID     string       `json:"id"`
	Source string       `json:"source"`
	Target string       `json:"target"`
	Kind   EdgeKind     `json:"kind"`
	Sync   *SyncConfig  `json:"sync,omitempty"`
	Mount  *MountConfig `json:"mount,omitempty"`
}

type EdgeKind string

const (
	EdgeSync  EdgeKind = "sync"
	EdgeMount EdgeKind = "mount"
	EdgeFlow  EdgeKind = "flow"
)

type SyncConfig struct {
	Operation  Operation   `json:"operation"`
	Schedule   Schedule    `json:"schedule"`
	Enabled    bool        `json:"enabled"`
	NextRun    *time.Time  `json:"next_run,omitempty"`
	LastResult *LastResult `json:"last_result,omitempty"`
}

func (s *SyncConfig) UnmarshalJSON(data []byte) error {
	var raw struct {
		Operation  Operation   `json:"operation"`
		Schedule   Schedule    `json:"schedule"`
		Enabled    *bool       `json:"enabled"`
		NextRun    *time.Time  `json:"next_run"`
		LastResult *LastResult `json:"last_result"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	s.Operation = raw.Operation
	s.Schedule = raw.Schedule
	s.Enabled = true
	if raw.Enabled != nil {
		s.Enabled = *raw.Enabled
	}
	s.NextRun = raw.NextRun
	s.LastResult = raw.LastResult
	if s.Schedule.Timezone == "" {
		s.Schedule.Timezone = "UTC"
	}
	return nil
}

func DefaultSync(operation Operation) SyncConfig {
	return SyncConfig{
		Operation: operation,
		Schedule:  DisabledSchedule(),
		Enabled:   true,
	}
}

type Operation string

const (
	OpCopy Operation = "copy"
	OpMove Operation = "move"
	OpSync Operation = "sync"
)

func (o Operation) RcloneCommand() string {
	switch o {
	case OpMove:
		return "sync/move"
	case OpSync:
		return "sync/sync"
	default:
		return "sync/copy"
	}
}

func (o Operation) Destructive() bool {
	return o == OpMove || o == OpSync
}

func (o Operation) Impact(source, target string) string {
	switch o {
	case OpMove:
		return "Move files from " + source + " to " + target + ". Files will be removed from the source."
	case OpSync:
		return "Sync " + source + " to " + target + ". Extra files on the destination may be deleted."
	default:
		return "Copy files from " + source + " to " + target + ". Source is unchanged."
	}
}

type Schedule struct {
	Mode     ScheduleMode    `json:"mode"`
	Preset   *SchedulePreset `json:"preset,omitempty"`
	Cron     *string         `json:"cron,omitempty"`
	Timezone string          `json:"timezone"`
	Enabled  bool            `json:"enabled"`
}

func (s *Schedule) UnmarshalJSON(data []byte) error {
	type alias Schedule
	var raw alias
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	*s = Schedule(raw)
	if s.Timezone == "" {
		s.Timezone = "UTC"
	}
	return nil
}

func DisabledSchedule() Schedule {
	preset := PresetDaily
	return Schedule{Mode: ModePreset, Preset: &preset, Timezone: "UTC", Enabled: false}
}

type ScheduleMode string

const (
	ModePreset ScheduleMode = "preset"
	ModeCron   ScheduleMode = "cron"
)

type SchedulePreset string

const (
	PresetHourly SchedulePreset = "hourly"
	PresetDaily  SchedulePreset = "daily"
	PresetWeekly SchedulePreset = "weekly"
)

type LastResult struct {
	JobID      string     `json:"job_id"`
	Status     string     `json:"status"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
	Error      *string    `json:"error,omitempty"`
}

type MountConfig struct {
	Enabled bool `json:"enabled"`
}

type CreateNode struct {
	Revision  uint64       `json:"revision"`
	ID        *string      `json:"id"`
	Kind      NodeKind     `json:"kind"`
	Label     string       `json:"label"`
	Position  Position     `json:"position"`
	LocalPath *string      `json:"local_path"`
	Remote    *Remote      `json:"remote"`
	Action    *ActionPatch `json:"action"`
}

type PatchNode struct {
	Revision  uint64       `json:"revision"`
	Label     *string      `json:"label"`
	Position  *Position    `json:"position"`
	LocalPath *string      `json:"local_path"`
	Remote    *Remote      `json:"remote"`
	Action    *ActionPatch `json:"action"`
}

// ActionPatch 只携带动作节点可编辑的字段，未填写的字段保持原值。
type ActionPatch struct {
	Operation *Operation `json:"operation"`
	Schedule  *Schedule  `json:"schedule"`
	Enabled   *bool      `json:"enabled"`
}

type CreateEdge struct {
	Revision  uint64     `json:"revision"`
	ID        *string    `json:"id"`
	Source    string     `json:"source"`
	Target    string     `json:"target"`
	Kind      EdgeKind   `json:"kind"`
	Operation *Operation `json:"operation"`
	Schedule  *Schedule  `json:"schedule"`
	Enabled   *bool      `json:"enabled"`
}

type PatchEdge struct {
	Revision  uint64     `json:"revision"`
	Operation *Operation `json:"operation"`
	Schedule  *Schedule  `json:"schedule"`
	Enabled   *bool      `json:"enabled"`
}

type PutRequest struct {
	Revision uint64   `json:"revision"`
	Nodes    []Node   `json:"nodes"`
	Edges    []Edge   `json:"edges"`
	Viewport Viewport `json:"viewport"`
}

type Store struct {
	path string
	mu   sync.Mutex
	doc  Document
	home string
}

func LoadOrCreate(path, home string) (*Store, error) {
	var doc Document
	if _, err := os.Stat(path); err == nil {
		loaded, err := load(path)
		if err != nil {
			return nil, err
		}
		doc = loaded
	} else if os.IsNotExist(err) {
		doc = EmptyDocument()
		if err := persist.AtomicWriteJSON(path, doc); err != nil {
			return nil, err
		}
	} else {
		return nil, core.IO(err)
	}
	if doc.Nodes == nil {
		doc.Nodes = []Node{}
	}
	if doc.Edges == nil {
		doc.Edges = []Edge{}
	}
	return &Store{path: path, doc: doc, home: home}, nil
}

func (s *Store) Home() string { return s.home }

func (s *Store) Get() Document {
	s.mu.Lock()
	defer s.mu.Unlock()
	return cloneDoc(s.doc)
}

func (s *Store) Replace(req PutRequest, remotes []string, remotesKnown bool) (Document, error) {
	return s.mutate(req.Revision, remotes, remotesKnown, func(doc *Document) error {
		doc.Nodes = req.Nodes
		doc.Edges = req.Edges
		doc.Viewport = req.Viewport
		return nil
	})
}

func (s *Store) CreateNode(req CreateNode, remotes []string, remotesKnown bool) (Document, error) {
	return s.mutate(req.Revision, remotes, remotesKnown, func(doc *Document) error {
		id := uuid.NewString()
		if req.ID != nil && *req.ID != "" {
			id = *req.ID
		}
		node := Node{
			ID:        id,
			Kind:      req.Kind,
			Label:     req.Label,
			Position:  req.Position,
			LocalPath: req.LocalPath,
			Remote:    req.Remote,
		}
		if req.Kind == NodeAction {
			action := DefaultAction()
			applyActionPatch(&action, req.Action)
			node.Action = &action
		}
		if doc.Node(node.ID) != nil {
			return core.Conflict("node " + node.ID + " already exists")
		}
		doc.Nodes = append(doc.Nodes, node)
		return nil
	})
}

func (s *Store) PatchNode(id string, req PatchNode, remotes []string, remotesKnown bool) (Document, error) {
	return s.mutate(req.Revision, remotes, remotesKnown, func(doc *Document) error {
		node := doc.Node(id)
		if node == nil {
			return core.NotFound("node " + id)
		}
		if req.Label != nil {
			node.Label = *req.Label
		}
		if req.Position != nil {
			node.Position = *req.Position
		}
		if req.LocalPath != nil {
			node.LocalPath = req.LocalPath
		}
		if req.Remote != nil {
			node.Remote = req.Remote
		}
		if req.Action != nil {
			if node.Kind != NodeAction {
				return core.InvalidRequest("node " + id + " is not an action node")
			}
			if node.Action == nil {
				action := DefaultAction()
				node.Action = &action
			}
			applyActionPatch(node.Action, req.Action)
		}
		return nil
	})
}

// DefaultAction 是新建动作节点的初始配置：复制、手动触发、启用。
func DefaultAction() Action {
	return Action{
		Operation: OpCopy,
		Schedule:  DisabledSchedule(),
		Enabled:   true,
	}
}

func applyActionPatch(action *Action, patch *ActionPatch) {
	if patch == nil {
		return
	}
	if patch.Operation != nil {
		action.Operation = *patch.Operation
	}
	if patch.Schedule != nil {
		action.Schedule = *patch.Schedule
	}
	if patch.Enabled != nil {
		action.Enabled = *patch.Enabled
	}
}

func (s *Store) DeleteNode(id string, revision uint64, remotes []string, remotesKnown bool) (Document, error) {
	return s.mutate(revision, remotes, remotesKnown, func(doc *Document) error {
		if doc.Node(id) == nil {
			return core.NotFound("node " + id)
		}
		nodes := make([]Node, 0, len(doc.Nodes))
		for _, node := range doc.Nodes {
			if node.ID != id {
				nodes = append(nodes, node)
			}
		}
		doc.Nodes = nodes
		edges := make([]Edge, 0, len(doc.Edges))
		for _, edge := range doc.Edges {
			if edge.Source != id && edge.Target != id {
				edges = append(edges, edge)
			}
		}
		doc.Edges = edges
		return nil
	})
}

func (s *Store) CreateEdge(req CreateEdge, remotes []string, remotesKnown bool) (Document, error) {
	return s.mutate(req.Revision, remotes, remotesKnown, func(doc *Document) error {
		id := uuid.NewString()
		if req.ID != nil && *req.ID != "" {
			id = *req.ID
		}
		edge := Edge{ID: id, Source: req.Source, Target: req.Target, Kind: req.Kind}
		switch req.Kind {
		case EdgeSync:
			operation := OpCopy
			if req.Operation != nil {
				operation = *req.Operation
			}
			config := DefaultSync(operation)
			if req.Schedule != nil {
				config.Schedule = *req.Schedule
			}
			if req.Enabled != nil {
				config.Enabled = *req.Enabled
			}
			edge.Sync = &config
		case EdgeMount:
			enabled := true
			if req.Enabled != nil {
				enabled = *req.Enabled
			}
			edge.Mount = &MountConfig{Enabled: enabled}
		case EdgeFlow:
			// 数据流边只表示关系，运行参数由动作节点持有。
		}
		if doc.Edge(edge.ID) != nil {
			return core.Conflict("edge " + edge.ID + " already exists")
		}
		doc.Edges = append(doc.Edges, edge)
		return nil
	})
}

func (s *Store) PatchEdge(id string, req PatchEdge, remotes []string, remotesKnown bool) (Document, error) {
	return s.mutate(req.Revision, remotes, remotesKnown, func(doc *Document) error {
		edge := doc.Edge(id)
		if edge == nil {
			return core.NotFound("edge " + id)
		}
		switch edge.Kind {
		case EdgeSync:
			if edge.Sync == nil {
				config := DefaultSync(OpCopy)
				edge.Sync = &config
			}
			if req.Operation != nil {
				edge.Sync.Operation = *req.Operation
			}
			if req.Schedule != nil {
				edge.Sync.Schedule = *req.Schedule
			}
			if req.Enabled != nil {
				edge.Sync.Enabled = *req.Enabled
			}
		case EdgeMount:
			if req.Operation != nil || req.Schedule != nil {
				return core.InvalidRequest("mount edges do not accept sync operation or schedule")
			}
			if req.Enabled != nil {
				edge.Mount = &MountConfig{Enabled: *req.Enabled}
			}
		}
		return nil
	})
}

func (s *Store) DeleteEdge(id string, revision uint64, remotes []string, remotesKnown bool) (Document, error) {
	return s.mutate(revision, remotes, remotesKnown, func(doc *Document) error {
		if doc.Edge(id) == nil {
			return core.NotFound("edge " + id)
		}
		edges := make([]Edge, 0, len(doc.Edges))
		for _, edge := range doc.Edges {
			if edge.ID != id {
				edges = append(edges, edge)
			}
		}
		doc.Edges = edges
		return nil
	})
}

func (s *Store) RecordJobResult(runID string, result LastResult, nextRun *time.Time) (Document, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if node := s.doc.Node(runID); node != nil && node.Kind == NodeAction && node.Action != nil {
		node.Action.LastResult = &result
		if nextRun != nil {
			node.Action.NextRun = nextRun
		}
	} else if edge := s.doc.Edge(runID); edge != nil && edge.Sync != nil {
		edge.Sync.LastResult = &result
		if nextRun != nil {
			edge.Sync.NextRun = nextRun
		}
	} else {
		return cloneDoc(s.doc), nil
	}
	s.doc.Revision++
	s.doc.UpdatedAt = time.Now().UTC()
	if err := persist.AtomicWriteJSON(s.path, s.doc); err != nil {
		return Document{}, err
	}
	return cloneDoc(s.doc), nil
}

func (s *Store) SetNextRun(runID string, nextRun *time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if node := s.doc.Node(runID); node != nil && node.Kind == NodeAction && node.Action != nil {
		node.Action.NextRun = nextRun
	} else if edge := s.doc.Edge(runID); edge != nil && edge.Sync != nil {
		edge.Sync.NextRun = nextRun
	} else {
		return nil
	}
	s.doc.UpdatedAt = time.Now().UTC()
	return persist.AtomicWriteJSON(s.path, s.doc)
}

func (s *Store) mutate(expected uint64, remotes []string, remotesKnown bool, mutate func(*Document) error) (Document, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.doc.Revision != expected {
		return Document{}, core.ConflictDetail(
			"workspace revision is stale: expected "+strconv.FormatUint(expected, 10)+", found "+strconv.FormatUint(s.doc.Revision, 10),
			map[string]any{
				"kind":     "workspace_revision",
				"expected": expected,
				"found":    s.doc.Revision,
			},
		)
	}
	next := cloneDoc(s.doc)
	if err := mutate(&next); err != nil {
		return Document{}, err
	}
	if err := Validate(&next, remotes, remotesKnown, s.home); err != nil {
		return Document{}, err
	}
	next.Revision++
	next.UpdatedAt = time.Now().UTC()
	if next.Nodes == nil {
		next.Nodes = []Node{}
	}
	if next.Edges == nil {
		next.Edges = []Edge{}
	}
	if err := persist.AtomicWriteJSON(s.path, next); err != nil {
		return Document{}, err
	}
	s.doc = next
	return cloneDoc(s.doc), nil
}

func RelatedEdgeIDs(doc Document, nodeID string) []string {
	var ids []string
	for _, edge := range doc.Edges {
		if edge.Source == nodeID || edge.Target == nodeID {
			ids = append(ids, edge.ID)
		}
	}
	return ids
}

func cloneDoc(doc Document) Document {
	raw, err := json.Marshal(doc)
	if err != nil {
		return doc
	}
	var copy Document
	if err := json.Unmarshal(raw, &copy); err != nil {
		return doc
	}
	if copy.Nodes == nil {
		copy.Nodes = []Node{}
	}
	if copy.Edges == nil {
		copy.Edges = []Edge{}
	}
	return copy
}
