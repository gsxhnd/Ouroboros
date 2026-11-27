package workspace

import (
	"strings"

	"github.com/google/uuid"
	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/paths"
)

// Mount 是一条挂载规则的只读视图。存储层仍然是 workspace 的 mount 边，
// ID 即边 ID。挂载只允许 remote 源 → local 目标。
type Mount struct {
	ID      string       `json:"id"`
	Name    string       `json:"name"`
	Source  TaskEndpoint `json:"source"`
	Target  TaskEndpoint `json:"target"`
	Enabled bool         `json:"enabled"`
}

func mountFromEdge(doc Document, edge Edge) Mount {
	name := ""
	enabled := false
	if edge.Mount != nil {
		name = edge.Mount.Name
		enabled = edge.Mount.Enabled
	}
	return Mount{
		ID:      edge.ID,
		Name:    name,
		Source:  taskEndpointFromNode(doc.Node(edge.Source)),
		Target:  taskEndpointFromNode(doc.Node(edge.Target)),
		Enabled: enabled,
	}
}

// ListMounts 返回当前所有挂载规则和文档版本号。
func (s *Store) ListMounts() ([]Mount, uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	doc := s.doc
	items := make([]Mount, 0)
	for _, edge := range doc.Edges {
		if edge.Kind != EdgeMount {
			continue
		}
		items = append(items, mountFromEdge(doc, edge))
	}
	return items, doc.Revision
}

type CreateMount struct {
	Revision uint64       `json:"revision"`
	Name     string       `json:"name"`
	Source   TaskEndpoint `json:"source"`
	Target   TaskEndpoint `json:"target"`
}

// CreateMount 创建一条挂载规则。源必须是 remote，目标必须是本地目录；
// 端点节点会自动复用或创建。同一本地目录不能被挂载两次。
func (s *Store) CreateMount(req CreateMount, remotes []string, remotesKnown bool) (Mount, Document, error) {
	var created Mount
	doc, err := s.mutate(req.Revision, remotes, remotesKnown, func(doc *Document) error {
		name := strings.TrimSpace(req.Name)
		if err := validateMountFields(name); err != nil {
			return err
		}
		if req.Source.Kind != paths.KindRemote {
			return core.InvalidRequest("mount source must be a remote")
		}
		if req.Target.Kind != paths.KindLocal {
			return core.InvalidRequest("mount target must be a local directory")
		}
		if err := validateTaskEndpoint(req.Source, remotes, remotesKnown, s.home); err != nil {
			return err
		}
		if err := validateTaskEndpoint(req.Target, remotes, remotesKnown, s.home); err != nil {
			return err
		}
		sourceID, err := findOrCreateNode(doc, req.Source, s.home)
		if err != nil {
			return err
		}
		targetID, err := findOrCreateNode(doc, req.Target, s.home)
		if err != nil {
			return err
		}
		for _, edge := range doc.Edges {
			if edge.Kind != EdgeMount {
				continue
			}
			if edge.Mount != nil && edge.Mount.Name == name {
				return core.Conflict("a mount named " + name + " already exists")
			}
			if edge.Target == targetID {
				return core.Conflict("this directory is already used as a mount point")
			}
		}
		edge := Edge{
			ID:     uuid.NewString(),
			Source: sourceID,
			Target: targetID,
			Kind:   EdgeMount,
			Mount:  &MountConfig{Name: name, Enabled: true},
		}
		doc.Edges = append(doc.Edges, edge)
		created = mountFromEdge(*doc, edge)
		return nil
	})
	if err != nil {
		return Mount{}, Document{}, err
	}
	return created, doc, nil
}

// DeleteMount 删除一条挂载规则，并清理不再被任何规则引用的端点节点。
func (s *Store) DeleteMount(id string, revision uint64) (Document, error) {
	return s.mutate(revision, nil, false, func(doc *Document) error {
		edge := doc.Edge(id)
		if edge == nil || edge.Kind != EdgeMount {
			return core.NotFound("mount " + id)
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

func validateMountFields(name string) error {
	if name == "" {
		return core.InvalidRequest("mount name is required")
	}
	if len(name) > 100 {
		return core.InvalidRequest("mount name is too long (max 100 characters)")
	}
	return nil
}
