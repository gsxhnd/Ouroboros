package workspace

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestValidateRejectsIllegalMountDirection(t *testing.T) {
	doc := Document{
		SchemaVersion: 1,
		Nodes: []Node{
			localNode("local", "/tmp/ourboros-local"),
			remoteNode("remote", "archive"),
		},
		Edges: []Edge{{
			ID: "e1", Source: "local", Target: "remote", Kind: EdgeMount,
		}},
		Viewport:  Viewport{Zoom: 1},
		UpdatedAt: time.Now().UTC(),
	}
	if err := Validate(&doc, nil, false, ""); err == nil {
		t.Fatal("expected illegal mount to fail")
	}
}

func TestValidateRejectsOrphanAndDuplicateEdges(t *testing.T) {
	doc := Document{
		SchemaVersion: 1,
		Nodes: []Node{
			localNode("local", "/tmp/ourboros-local"),
			remoteNode("remote", "archive"),
		},
		Edges: []Edge{{
			ID: "e1", Source: "missing", Target: "local", Kind: EdgeSync,
			Sync: ptrSync(DefaultSync(OpCopy)),
		}},
		Viewport:  Viewport{Zoom: 1},
		UpdatedAt: time.Now().UTC(),
	}
	if err := Validate(&doc, nil, false, ""); err == nil {
		t.Fatal("expected orphan edge to fail")
	}
	doc.Edges[0].Source = "remote"
	if err := Validate(&doc, nil, false, ""); err != nil {
		t.Fatal(err)
	}
	// 同端点对的多条同步规则合法（例如复制 + 双向同步）。
	doc.Edges = append(doc.Edges, Edge{
		ID: "e2", Source: "remote", Target: "local", Kind: EdgeSync,
		Sync: ptrSync(DefaultSync(OpBisync)),
	})
	if err := Validate(&doc, nil, false, ""); err != nil {
		t.Fatal(err)
	}
	// 重复挂载同一端点对仍然拒绝。
	doc.Edges = append(doc.Edges,
		Edge{ID: "e3", Source: "remote", Target: "local", Kind: EdgeMount},
		Edge{ID: "e4", Source: "remote", Target: "local", Kind: EdgeMount},
	)
	if err := Validate(&doc, nil, false, ""); err == nil {
		t.Fatal("expected duplicate mount to fail")
	}
}

func TestValidateRejectsUnknownEdgeKind(t *testing.T) {
	doc := Document{
		SchemaVersion: 1,
		Nodes: []Node{
			localNode("local", "/tmp/ourboros-local"),
			remoteNode("remote", "archive"),
		},
		Edges: []Edge{{
			ID: "e1", Source: "local", Target: "remote", Kind: "flow",
		}},
		Viewport:  Viewport{Zoom: 1},
		UpdatedAt: time.Now().UTC(),
	}
	if err := Validate(&doc, nil, false, ""); err == nil {
		t.Fatal("expected unknown edge kind to fail")
	}
}

func TestValidateSyncLimits(t *testing.T) {
	base := func(limit, maxTransfer string) Document {
		return Document{
			SchemaVersion: 1,
			Nodes: []Node{
				localNode("local", "/tmp/ourboros-local"),
				remoteNode("remote", "archive"),
			},
			Edges: []Edge{{
				ID: "e1", Source: "local", Target: "remote", Kind: EdgeSync,
				Sync: ptrSync(func() SyncConfig {
					config := DefaultSync(OpCopy)
					config.BWLimit = limit
					config.MaxTransfer = maxTransfer
					return config
				}()),
			}},
			Viewport:  Viewport{Zoom: 1},
			UpdatedAt: time.Now().UTC(),
		}
	}
	for _, value := range []string{"10MiB", "1.5M", "100", "off", ""} {
		if err := Validate(ptrDoc(base(value, "")), nil, false, ""); err != nil {
			t.Fatalf("bw_limit %q: %v", value, err)
		}
	}
	for _, value := range []string{"10M:00:00", "abc", "-1G", "5X"} {
		if err := Validate(ptrDoc(base(value, "")), nil, false, ""); err == nil {
			t.Fatalf("bw_limit %q should fail", value)
		}
	}
	if err := Validate(ptrDoc(base("", "1GiB")), nil, false, ""); err != nil {
		t.Fatal(err)
	}
	if err := Validate(ptrDoc(base("", "off")), nil, false, ""); err != nil {
		t.Fatal(err)
	}
	if err := Validate(ptrDoc(base("", "1M:00:00")), nil, false, ""); err == nil {
		t.Fatal("max_transfer timetable should fail")
	}
}

func TestLoadRoundTrip(t *testing.T) {
	dir := t.TempDir()
	local := filepath.Join(dir, "local")
	if err := os.MkdirAll(local, 0o755); err != nil {
		t.Fatal(err)
	}
	store, err := LoadOrCreate(filepath.Join(dir, "workspace.json"), "")
	if err != nil {
		t.Fatal(err)
	}
	doc, err := store.CreateNode(CreateNode{
		Revision: 0, Kind: NodeLocal, Label: "Backups",
		Position: Position{X: 1, Y: 2}, LocalPath: &local,
	}, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	if doc.Revision != 1 {
		t.Fatalf("revision %d", doc.Revision)
	}
}

// TestMigrateStripsCanvasArtifacts 验证旧画布文档里的 action 节点和 flow 边在
// 加载时被清理，同步与挂载内容保持不变。
func TestMigrateStripsCanvasArtifacts(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "workspace.json")
	raw := `{
		"schema_version": 1,
		"revision": 3,
		"nodes": [
			{"id": "local", "kind": "local", "label": "L", "position": {"x":0,"y":0}, "local_path": "/tmp/ourboros-local"},
			{"id": "act", "kind": "action", "label": "A", "position": {"x":0,"y":0}}
		],
		"edges": [
			{"id": "e1", "source": "local", "target": "act", "kind": "flow"},
			{"id": "e2", "source": "local", "target": "remote", "kind": "sync"}
		]
	}`
	if err := os.WriteFile(path, []byte(raw), 0o644); err != nil {
		t.Fatal(err)
	}
	store, err := LoadOrCreate(path, "")
	if err != nil {
		t.Fatal(err)
	}
	doc := store.Get()
	if len(doc.Nodes) != 1 || doc.Nodes[0].ID != "local" {
		t.Fatalf("expected action node removed, got %v", doc.Nodes)
	}
	if len(doc.Edges) != 1 || doc.Edges[0].ID != "e2" {
		t.Fatalf("expected flow edge removed, got %v", doc.Edges)
	}
}

func localNode(id, path string) Node {
	return Node{ID: id, Kind: NodeLocal, Label: id, LocalPath: &path}
}

func remoteNode(id, name string) Node {
	return Node{ID: id, Kind: NodeRemote, Label: id, Remote: &Remote{Name: name}}
}

func ptrSync(config SyncConfig) *SyncConfig { return &config }

func ptrDoc(doc Document) *Document { return &doc }
