package workspace

import (
	"math"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/paths"
)

// ParseSize 解析 rclone 风格的容量字符串，例如 "100"、"10M"、"1.5GiB"。
// 仅支持单个大小值，不支持带宽时间表（"10M:00:00"）这类复杂格式。
func ParseSize(value string) (int64, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0, core.InvalidPath("size value is empty")
	}
	i := 0
	for i < len(trimmed) && (trimmed[i] >= '0' && trimmed[i] <= '9' || trimmed[i] == '.') {
		i++
	}
	number := trimmed[:i]
	unit := strings.ToLower(strings.TrimSpace(trimmed[i:]))
	if number == "" {
		return 0, core.InvalidPath("size must start with a number: " + value)
	}
	multiplier := 1.0
	switch unit {
	case "", "b":
		multiplier = 1
	case "k", "kb", "kib":
		multiplier = 1 << 10
	case "m", "mb", "mib":
		multiplier = 1 << 20
	case "g", "gb", "gib":
		multiplier = 1 << 30
	case "t", "tb", "tib":
		multiplier = 1 << 40
	case "p", "pb", "pib":
		multiplier = 1 << 50
	default:
		return 0, core.InvalidRequest("size unit must be B, K, M, G, T or P (optionally iB): " + value)
	}
	parsed, err := strconv.ParseFloat(number, 64)
	if err != nil || parsed < 0 {
		return 0, core.InvalidRequest("invalid size value: " + value)
	}
	bytes := parsed * multiplier
	if bytes > math.MaxInt64 {
		return 0, core.InvalidRequest("size value is too large: " + value)
	}
	return int64(bytes), nil
}

// ValidateBWLimit 校验限速值：空或 "off" 表示不限速，其余必须是单个大小值。
// rclone 的带宽限制器是进程级的，因此这里刻意不接受时间表格式。
func ValidateBWLimit(value string) error {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || strings.EqualFold(trimmed, "off") {
		return nil
	}
	_, err := ParseSize(trimmed)
	return err
}

// ValidateMaxTransfer 校验单次同步大小上限：空或 "off" 表示无上限。
func ValidateMaxTransfer(value string) error {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || strings.EqualFold(trimmed, "off") {
		return nil
	}
	_, err := ParseSize(trimmed)
	return err
}

// TaskEndpoint 是同步任务的源或目标：一个本地目录，或一个 remote 及其内部路径。
type TaskEndpoint struct {
	Kind   paths.Kind `json:"kind"` // "local" | "remote"
	Path   string     `json:"path,omitempty"`
	Remote string     `json:"remote,omitempty"`
}

func (e TaskEndpoint) Locator(home string) (paths.Locator, error) {
	switch e.Kind {
	case paths.KindLocal:
		return paths.Parse(e.Path, "", home)
	case paths.KindRemote:
		return paths.Parse(e.Remote, e.Path, home)
	default:
		return paths.Locator{}, core.InvalidRequest("endpoint kind must be local or remote")
	}
}

func (e TaskEndpoint) Display() string {
	locator, err := e.Locator("")
	if err != nil {
		return e.Path
	}
	return locator.Display()
}

func validateTaskEndpoint(e TaskEndpoint, remotes []string, remotesKnown bool, home string) error {
	switch e.Kind {
	case paths.KindLocal:
		if strings.TrimSpace(e.Path) == "" {
			return core.InvalidPath("local endpoint requires a path")
		}
		if e.Remote != "" {
			return core.InvalidRequest("local endpoint must not include a remote")
		}
		normalized, err := paths.ValidateLocal(e.Path, home)
		if err != nil {
			return err
		}
		info, err := os.Stat(normalized)
		if err == nil && !info.IsDir() {
			return core.InvalidPath("local endpoint path must be a directory")
		}
		if err != nil && !os.IsNotExist(err) {
			return core.IO(err)
		}
	case paths.KindRemote:
		name, err := paths.ValidateRemoteName(e.Remote)
		if err != nil {
			return err
		}
		if _, err := paths.ValidateRelative(e.Path); err != nil {
			return err
		}
		if remotesKnown {
			found := false
			for _, item := range remotes {
				if item == name {
					found = true
					break
				}
			}
			if !found {
				return core.NotFound("remote " + name)
			}
		}
	default:
		return core.InvalidRequest("endpoint kind must be local or remote")
	}
	return nil
}

func taskEndpointFromNode(node *Node) TaskEndpoint {
	if node == nil {
		return TaskEndpoint{}
	}
	switch node.Kind {
	case NodeLocal:
		path := ""
		if node.LocalPath != nil {
			path = *node.LocalPath
		}
		return TaskEndpoint{Kind: paths.KindLocal, Path: path}
	case NodeRemote:
		if node.Remote == nil {
			return TaskEndpoint{}
		}
		return TaskEndpoint{Kind: paths.KindRemote, Remote: node.Remote.Name, Path: node.Remote.Path}
	default:
		return TaskEndpoint{}
	}
}

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

func taskFromEdge(doc Document, edge Edge, home string) SyncTask {
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
		tasks = append(tasks, taskFromEdge(doc, edge, s.home))
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
		created = taskFromEdge(*doc, edge, s.home)
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
		updated = taskFromEdge(*doc, *edge, s.home)
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

// findOrCreateNode 找到与端点相同位置的存储节点，不存在时创建一个。
// 画布移除后节点只是端点的存储形式，位置字段不再有 UI 语义，仅用于兼容。
func findOrCreateNode(doc *Document, e TaskEndpoint, home string) (string, error) {
	switch e.Kind {
	case paths.KindLocal:
		normalized, err := paths.ValidateLocal(e.Path, home)
		if err != nil {
			return "", err
		}
		for i := range doc.Nodes {
			node := &doc.Nodes[i]
			if node.Kind == NodeLocal && node.LocalPath != nil && pathsValidateLocalEqual(*node.LocalPath, normalized) {
				return node.ID, nil
			}
		}
		path := normalized
		id := uuid.NewString()
		doc.Nodes = append(doc.Nodes, Node{
			ID:        id,
			Kind:      NodeLocal,
			Label:     path,
			Position:  Position{X: 80, Y: float64(80 * (len(doc.Nodes) + 1))},
			LocalPath: &path,
		})
		return id, nil
	case paths.KindRemote:
		name, err := paths.ValidateRemoteName(e.Remote)
		if err != nil {
			return "", err
		}
		relative, err := paths.ValidateRelative(e.Path)
		if err != nil {
			return "", err
		}
		for i := range doc.Nodes {
			node := &doc.Nodes[i]
			if node.Kind == NodeRemote && node.Remote != nil && node.Remote.Name == name && node.Remote.Path == relative {
				return node.ID, nil
			}
		}
		id := uuid.NewString()
		doc.Nodes = append(doc.Nodes, Node{
			ID:       id,
			Kind:     NodeRemote,
			Label:    name,
			Position: Position{X: 80, Y: float64(80 * (len(doc.Nodes) + 1))},
			Remote:   &Remote{Name: name, Path: relative},
		})
		return id, nil
	default:
		return "", core.InvalidRequest("endpoint kind must be local or remote")
	}
}

// pathsValidateLocalEqual 以 ~ 展开后的形式比较两个本地路径是否指向同一目录。
func pathsValidateLocalEqual(raw, normalized string) bool {
	if raw == normalized {
		return true
	}
	cleaned, err := paths.ValidateLocal(raw, "")
	return err == nil && cleaned == normalized
}

// removeTaskOrphans 删除给定节点中不再被任何边引用的节点。只有同步任务的端点
// 节点会走到这里，手动通过节点 API 创建的孤立节点不受影响。
func removeTaskOrphans(doc *Document, nodeIDs ...string) {
	for _, id := range nodeIDs {
		if id == "" {
			continue
		}
		referenced := false
		for _, edge := range doc.Edges {
			if edge.Source == id || edge.Target == id {
				referenced = true
				break
			}
		}
		if referenced {
			continue
		}
		nodes := make([]Node, 0, len(doc.Nodes))
		for _, node := range doc.Nodes {
			if node.ID != id {
				nodes = append(nodes, node)
			}
		}
		doc.Nodes = nodes
	}
}
