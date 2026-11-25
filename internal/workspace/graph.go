package workspace

import (
	"github.com/google/uuid"
	"github.com/gsxhnd/ourboros/internal/core"
)

type CreateNode struct {
	Revision  uint64   `json:"revision"`
	ID        *string  `json:"id"`
	Kind      NodeKind `json:"kind"`
	Label     string   `json:"label"`
	LocalPath *string  `json:"local_path"`
	Remote    *Remote  `json:"remote"`
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
			LocalPath: req.LocalPath,
			Remote:    req.Remote,
		}
		if doc.Node(node.ID) != nil {
			return core.Conflict("node " + node.ID + " already exists")
		}
		doc.Nodes = append(doc.Nodes, node)
		return nil
	})
}

func (s *Store) DeleteNode(id string, revision uint64, remotes []string, remotesKnown bool) (Document, error) {
	return s.mutate(revision, remotes, remotesKnown, func(doc *Document) error {
		if doc.Node(id) == nil {
			return core.NotFound("node " + id)
		}
		// 存储页的删除不允许级联：仍被同步任务或挂载引用的端点必须先删除
		// 对应规则，避免静默连带删除用户配置。
		for _, edge := range doc.Edges {
			if edge.Source == id || edge.Target == id {
				return core.ConflictDetail(
					"storage is referenced by a sync task or mount; delete those first",
					map[string]any{"kind": "node_in_use"},
				)
			}
		}
		nodes := make([]Node, 0, len(doc.Nodes))
		for _, node := range doc.Nodes {
			if node.ID != id {
				nodes = append(nodes, node)
			}
		}
		doc.Nodes = nodes
		return nil
	})
}
