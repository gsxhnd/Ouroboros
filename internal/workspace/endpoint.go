package workspace

import (
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/paths"
)

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

// findOrCreateNode 找到与端点相同位置的存储节点，不存在时创建一个。
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
			ID:     id,
			Kind:   NodeRemote,
			Label:  name,
			Remote: &Remote{Name: name, Path: relative},
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
