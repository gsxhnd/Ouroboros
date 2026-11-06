package workspace

import (
	"encoding/json"
	"os"
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/paths"
	"github.com/gsxhnd/ourboros/internal/persist"
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
	pairs := map[string]struct{}{}
	for _, edge := range doc.Edges {
		if _, ok := edges[edge.ID]; ok {
			return core.InvalidRequest("duplicate edge id " + edge.ID)
		}
		edges[edge.ID] = struct{}{}
		pair := edge.Source + "\x00" + edge.Target
		if _, ok := pairs[pair]; ok {
			return core.InvalidRequest("duplicate edge from " + edge.Source + " to " + edge.Target)
		}
		pairs[pair] = struct{}{}
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
		}
		if edge.Kind == EdgeFlow {
			if err := validateFlowEdge(source, target); err != nil {
				return err
			}
		}
	}
	for i := range doc.Nodes {
		node := &doc.Nodes[i]
		if node.Kind == NodeAction {
			if err := validateActionNode(node); err != nil {
				return err
			}
		}
	}
	return nil
}

// validateFlowEdge 只允许 存储 → 动作 或 动作 → 存储，禁止动作直连动作和存储直连存储。
func validateFlowEdge(source, target *Node) error {
	sourceAction := source.Kind == NodeAction
	targetAction := target.Kind == NodeAction
	if sourceAction == targetAction {
		return core.InvalidRequest("flow edges must connect a storage node and an action node")
	}
	return nil
}

// validateActionNode 只校验字段本身。画布允许先放置动作节点再逐步连线，
// 上下游数量在运行时由 ActionEndpoints 检查。
func validateActionNode(node *Node) error {
	if node.Action == nil {
		return core.InvalidRequest("action node " + node.ID + " is missing action configuration")
	}
	return ValidateSchedule(node.Action.Schedule)
}

// ActionEndpoints 返回动作节点唯一的上游和下游存储节点，结构不满足时返回错误。
func ActionEndpoints(doc Document, nodeID string) (source, target *Node, err error) {
	node := doc.Node(nodeID)
	if node == nil || node.Kind != NodeAction {
		return nil, nil, core.NotFound("action node " + nodeID)
	}
	var inputs, outputs []string
	for _, edge := range doc.Edges {
		if edge.Kind != EdgeFlow {
			continue
		}
		if edge.Target == nodeID {
			inputs = append(inputs, edge.Source)
		}
		if edge.Source == nodeID {
			outputs = append(outputs, edge.Target)
		}
	}
	if len(inputs) != 1 || len(outputs) != 1 {
		return nil, nil, core.InvalidRequest("action node " + nodeID + " needs exactly one source and one destination")
	}
	source = doc.Node(inputs[0])
	target = doc.Node(outputs[0])
	if source == nil || target == nil {
		return nil, nil, core.InvalidRequest("action node " + nodeID + " references a missing node")
	}
	if source.Kind == NodeAction || target.Kind == NodeAction {
		return nil, nil, core.InvalidRequest("action node " + nodeID + " cannot chain with another action node")
	}
	return source, target, nil
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
	case NodeAction:
		if node.Remote != nil || node.LocalPath != nil {
			return core.InvalidRequest("action node " + node.ID + " must not include a location")
		}
	default:
		return core.InvalidRequest("unknown node kind")
	}
	return nil
}

func load(path string) (Document, error) {
	data, err := persist.ReadJSONBytes(path)
	if err != nil {
		return Document{}, err
	}
	var value map[string]any
	if err := json.Unmarshal(data, &value); err != nil {
		return Document{}, core.CorruptStore(path + ": " + err.Error())
	}
	return migrate(value)
}

func migrate(value map[string]any) (Document, error) {
	if value == nil {
		return Document{}, core.CorruptStore("workspace document is not an object")
	}
	version := uint32(0)
	if raw, ok := value["schema_version"].(float64); ok {
		version = uint32(raw)
	}
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
		if _, ok := value["viewport"]; !ok {
			value["viewport"] = map[string]any{"x": 0, "y": 0, "zoom": 1}
		}
		if _, ok := value["updated_at"]; !ok {
			value["updated_at"] = time.Now().UTC()
		}
	case SchemaVersion:
	default:
		return Document{}, core.UnsupportedSchema("workspace", version)
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return Document{}, core.CorruptStore("workspace: " + err.Error())
	}
	var doc Document
	if err := json.Unmarshal(raw, &doc); err != nil {
		return Document{}, core.CorruptStore("workspace: " + err.Error())
	}
	return doc, nil
}
