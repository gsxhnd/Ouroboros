package workspace

import (
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/persist"
)

func load(path string) (Document, error) {
	doc, err := persist.LoadVersioned[Document](path, "workspace", migrate)
	if err != nil {
		return Document{}, err
	}
	return dropCanvasArtifacts(doc), nil
}

// migrate upgrades a raw workspace object to the current schema in place.
func migrate(value map[string]any, version uint32) error {
	switch version {
	case 0:
		value["schema_version"] = SchemaVersion
		if _, ok := value["revision"]; !ok {
			value["revision"] = 0
		}
		if _, ok := value["nodes"]; !ok {
			value["nodes"] = []any{}
		}
		if _, ok := value["edges"]; !ok {
			value["edges"] = []any{}
		}
		if _, ok := value["updated_at"]; !ok {
			value["updated_at"] = time.Now().UTC()
		}
	case SchemaVersion:
	default:
		return core.UnsupportedSchema("workspace", version)
	}
	return nil
}

// dropCanvasArtifacts 画布功能已移除：清理历史文档里遗留的 action 节点和 flow 边。
func dropCanvasArtifacts(doc Document) Document {
	nodes := doc.Nodes[:0]
	for _, node := range doc.Nodes {
		if node.Kind == NodeLocal || node.Kind == NodeRemote {
			nodes = append(nodes, node)
		}
	}
	doc.Nodes = nodes
	edges := doc.Edges[:0]
	for _, edge := range doc.Edges {
		if edge.Kind == EdgeSync || edge.Kind == EdgeMount {
			edges = append(edges, edge)
		}
	}
	doc.Edges = edges
	return doc
}
