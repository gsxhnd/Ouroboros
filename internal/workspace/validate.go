package workspace

import (
	"os"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/paths"
)

func Validate(doc *Document, remotes []string, remotesKnown bool, home string) error {
	nodes := map[string]struct{}{}
	for i := range doc.Nodes {
		node := &doc.Nodes[i]
		if _, ok := nodes[node.ID]; ok {
			return core.InvalidRequest("duplicate node id " + node.ID)
		}
		nodes[node.ID] = struct{}{}
		if err := validateNode(node, remotes, remotesKnown, home); err != nil {
			return err
		}
	}
	edges := map[string]struct{}{}
	mountPairs := map[string]struct{}{}
	for _, edge := range doc.Edges {
		if _, ok := edges[edge.ID]; ok {
			return core.InvalidRequest("duplicate edge id " + edge.ID)
		}
		edges[edge.ID] = struct{}{}
		if edge.Kind != EdgeSync && edge.Kind != EdgeMount {
			return core.InvalidRequest("unknown edge kind " + string(edge.Kind))
		}
		// 同一端点对允许多条同步规则（例如复制 + 双向同步），但重复挂载同一
		// remote/path 到同一本地目录会互相冲突，仍然拒绝。
		if edge.Kind == EdgeMount {
			pair := edge.Source + "\x00" + edge.Target
			if _, ok := mountPairs[pair]; ok {
				return core.InvalidRequest("duplicate mount from " + edge.Source + " to " + edge.Target)
			}
			mountPairs[pair] = struct{}{}
		}
		source := doc.Node(edge.Source)
		if source == nil {
			return core.InvalidRequest("edge " + edge.ID + " references missing source")
		}
		target := doc.Node(edge.Target)
		if target == nil {
			return core.InvalidRequest("edge " + edge.ID + " references missing target")
		}
		if edge.Kind == EdgeMount && (source.Kind != NodeRemote || target.Kind != NodeLocal) {
			return core.InvalidRequest("mount edges must go from a remote source to a local target")
		}
		if edge.Kind == EdgeSync && edge.Sync == nil {
			return core.InvalidRequest("sync edge " + edge.ID + " is missing sync configuration")
		}
		if edge.Sync != nil {
			if err := ValidateSchedule(edge.Sync.Schedule); err != nil {
				return err
			}
			if err := ValidateBWLimit(edge.Sync.BWLimit); err != nil {
				return err
			}
			if err := ValidateMaxTransfer(edge.Sync.MaxTransfer); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateNode(node *Node, remotes []string, remotesKnown bool, home string) error {
	switch node.Kind {
	case NodeLocal:
		if node.LocalPath == nil {
			return core.InvalidPath("local node " + node.ID + " requires local_path")
		}
		normalized, err := paths.ValidateLocal(*node.LocalPath, home)
		if err != nil {
			return err
		}
		info, err := os.Stat(normalized)
		if err == nil && !info.IsDir() {
			return core.InvalidPath("local node " + node.ID + " path must be a directory")
		}
		if err != nil && !os.IsNotExist(err) {
			return core.IO(err)
		}
		if node.Remote != nil {
			return core.InvalidRequest("local node " + node.ID + " must not include a remote")
		}
	case NodeRemote:
		if node.Remote == nil {
			return core.InvalidPath("remote node " + node.ID + " requires remote")
		}
		name, err := paths.ValidateRemoteName(node.Remote.Name)
		if err != nil {
			return err
		}
		if _, err := paths.ValidateRelative(node.Remote.Path); err != nil {
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
		if node.LocalPath != nil {
			return core.InvalidRequest("remote node " + node.ID + " must not include local_path")
		}
	default:
		return core.InvalidRequest("unknown node kind")
	}
	return nil
}
