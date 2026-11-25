package workspace

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gsxhnd/ourboros/internal/core"
)

// SyncTask 是一条同步规则的只读视图。存储层仍然是 workspace 的节点/边文档，
// 任务 ID 即同步边 ID。
type SyncTask struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Operation   Operation    `json:"operation"`
	Source      TaskEndpoint `json:"source"`
	Target      TaskEndpoint `json:"target"`
	BWLimit     string       `json:"bw_limit,omitempty"`
	MaxTransfer string       `json:"max_transfer,omitempty"`
	Schedule    Schedule     `json:"schedule"`
	Enabled     bool         `json:"enabled"`
	NextRun     *time.Time   `json:"next_run,omitempty"`
	LastResult  *LastResult  `json:"last_result,omitempty"`
	Destructive bool         `json:"destructive"`
	Impact      string       `json:"impact"`
}

func taskFromEdge(doc Document, edge Edge) SyncTask {
	config := DefaultSync(OpCopy)
	if edge.Sync != nil {
		config = *edge.Sync
	}
	return SyncTask{
		ID:          edge.ID,
		Name:        config.Name,
		Operation:   config.Operation,
		Source:      taskEndpointFromNode(doc.Node(edge.Source)),
		Target:      taskEndpointFromNode(doc.Node(edge.Target)),
		BWLimit:     config.BWLimit,
		MaxTransfer: config.MaxTransfer,
		Schedule:    config.Schedule,
		Enabled:     config.Enabled,
		NextRun:     config.NextRun,
		LastResult:  config.LastResult,
		Destructive: config.Operation.Destructive(),
		Impact:      config.Operation.Impact(taskEndpointFromNode(doc.Node(edge.Source)).Display(), taskEndpointFromNode(doc.Node(edge.Target)).Display()),
	}
}

// SyncTasks 返回当前所有同步任务和文档版本号。
func (s *Store) SyncTasks() ([]SyncTask, uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	doc := s.doc
	tasks := make([]SyncTask, 0, len(doc.Edges))
	for _, edge := range doc.Edges {
		if edge.Kind != EdgeSync || edge.Sync == nil {
			continue
		}
		tasks = append(tasks, taskFromEdge(doc, edge))
	}
	return tasks, doc.Revision
}

type CreateSyncTask struct {
	Revision    uint64       `json:"revision"`
	Name        string       `json:"name"`
	Source      TaskEndpoint `json:"source"`
	Target      TaskEndpoint `json:"target"`
	Operation   Operation    `json:"operation"`
	BWLimit     string       `json:"bw_limit,omitempty"`
	MaxTransfer string       `json:"max_transfer,omitempty"`
	Schedule    *Schedule    `json:"schedule,omitempty"`
	Enabled     *bool        `json:"enabled,omitempty"`
}

// CreateSyncTask 创建一条同步规则。源和目标端点会自动落到（或复用）存储节点上，
// 调用方无需关心底层的节点/边结构。
func (s *Store) CreateSyncTask(req CreateSyncTask, remotes []string, remotesKnown bool) (SyncTask, Document, error) {
	var created SyncTask
	doc, err := s.mutate(req.Revision, remotes, remotesKnown, func(doc *Document) error {
		if err := validateSyncTaskFields(req.Name, req.Operation, req.BWLimit, req.MaxTransfer); err != nil {
			return err
		}
		if err := validateTaskEndpoint(req.Source, remotes, remotesKnown, s.home); err != nil {
			return err
		}
		if err := validateTaskEndpoint(req.Target, remotes, remotesKnown, s.home); err != nil {
			return err
		}
		for _, edge := range doc.Edges {
			if edge.Kind == EdgeSync && edge.Sync != nil && edge.Sync.Name == req.Name {
				return core.Conflict("a sync task named " + req.Name + " already exists")
			}
		}
		sourceID, err := findOrCreateNode(doc, req.Source, s.home)
		if err != nil {
			return err
		}
		targetID, err := findOrCreateNode(doc, req.Target, s.home)
		if err != nil {
			return err
		}
		config := DefaultSync(req.Operation)
		config.Name = strings.TrimSpace(req.Name)
		config.BWLimit = strings.TrimSpace(req.BWLimit)
		config.MaxTransfer = strings.TrimSpace(req.MaxTransfer)
		if req.Schedule != nil {
			config.Schedule = *req.Schedule
		}
		if req.Enabled != nil {
			config.Enabled = *req.Enabled
		}
		edge := Edge{ID: uuid.NewString(), Source: sourceID, Target: targetID, Kind: EdgeSync, Sync: &config}
		doc.Edges = append(doc.Edges, edge)
		created = taskFromEdge(*doc, edge)
		return nil
	})
	if err != nil {
		return SyncTask{}, Document{}, err
	}
	return created, doc, nil
}

type PatchSyncTask struct {
	Revision    uint64        `json:"revision"`
	Name        *string       `json:"name,omitempty"`
	Source      *TaskEndpoint `json:"source,omitempty"`
	Target      *TaskEndpoint `json:"target,omitempty"`
	Operation   *Operation    `json:"operation,omitempty"`
	BWLimit     *string       `json:"bw_limit,omitempty"`
	MaxTransfer *string       `json:"max_transfer,omitempty"`
	Schedule    *Schedule     `json:"schedule,omitempty"`
	Enabled     *bool         `json:"enabled,omitempty"`
}

// PatchSyncTask 更新一条同步规则。更换端点时旧节点如果没有被其他规则引用会被清理。
func (s *Store) PatchSyncTask(id string, req PatchSyncTask, remotes []string, remotesKnown bool) (SyncTask, Document, error) {
	var updated SyncTask
	doc, err := s.mutate(req.Revision, remotes, remotesKnown, func(doc *Document) error {
		edge := doc.Edge(id)
		if edge == nil || edge.Kind != EdgeSync || edge.Sync == nil {
			return core.NotFound("sync task " + id)
		}
		if req.Name != nil {
			if strings.TrimSpace(*req.Name) == "" {
				return core.InvalidRequest("sync task name must not be empty")
			}
			for _, other := range doc.Edges {
				if other.ID != id && other.Kind == EdgeSync && other.Sync != nil && other.Sync.Name == strings.TrimSpace(*req.Name) {
					return core.Conflict("a sync task named " + *req.Name + " already exists")
				}
			}
			edge.Sync.Name = strings.TrimSpace(*req.Name)
		}
		if req.Operation != nil {
			if _, err := ParseOperation(string(*req.Operation)); err != nil {
				return err
			}
			edge.Sync.Operation = *req.Operation
		}
		if req.BWLimit != nil {
			if err := ValidateBWLimit(*req.BWLimit); err != nil {
				return err
			}
			edge.Sync.BWLimit = strings.TrimSpace(*req.BWLimit)
		}
		if req.MaxTransfer != nil {
			if err := ValidateMaxTransfer(*req.MaxTransfer); err != nil {
				return err
			}
			edge.Sync.MaxTransfer = strings.TrimSpace(*req.MaxTransfer)
		}
		if req.Schedule != nil {
			edge.Sync.Schedule = *req.Schedule
		}
		if req.Enabled != nil {
			edge.Sync.Enabled = *req.Enabled
		}
		if req.Source != nil {
			if err := validateTaskEndpoint(*req.Source, remotes, remotesKnown, s.home); err != nil {
				return err
			}
			sourceID, err := findOrCreateNode(doc, *req.Source, s.home)
			if err != nil {
				return err
			}
			old := edge.Source
			edge.Source = sourceID
			removeTaskOrphans(doc, old)
		}
		if req.Target != nil {
			if err := validateTaskEndpoint(*req.Target, remotes, remotesKnown, s.home); err != nil {
				return err
			}
			targetID, err := findOrCreateNode(doc, *req.Target, s.home)
			if err != nil {
				return err
			}
			old := edge.Target
			edge.Target = targetID
			removeTaskOrphans(doc, old)
		}
		updated = taskFromEdge(*doc, *edge)
		return nil
	})
	if err != nil {
		return SyncTask{}, Document{}, err
	}
	return updated, doc, nil
}

// DeleteSyncTask 删除一条同步规则，并清理不再被任何规则引用的端点节点。
func (s *Store) DeleteSyncTask(id string, revision uint64) (Document, error) {
	return s.mutate(revision, nil, false, func(doc *Document) error {
		edge := doc.Edge(id)
		if edge == nil || edge.Kind != EdgeSync {
			return core.NotFound("sync task " + id)
		}
		edges := make([]Edge, 0, len(doc.Edges))
		for _, item := range doc.Edges {
			if item.ID != id {
				edges = append(edges, item)
			}
		}
		doc.Edges = edges
		removeTaskOrphans(doc, edge.Source, edge.Target)
		return nil
	})
}

// validateSyncTaskFields 校验任务名称、操作类型和限速/限额格式。
func validateSyncTaskFields(name string, operation Operation, bwLimit, maxTransfer string) error {
	if strings.TrimSpace(name) == "" {
		return core.InvalidRequest("sync task name is required")
	}
	if len(strings.TrimSpace(name)) > 100 {
		return core.InvalidRequest("sync task name is too long (max 100 characters)")
	}
	if _, err := ParseOperation(string(operation)); err != nil {
		return err
	}
	if err := ValidateBWLimit(bwLimit); err != nil {
		return err
	}
	return ValidateMaxTransfer(maxTransfer)
}
