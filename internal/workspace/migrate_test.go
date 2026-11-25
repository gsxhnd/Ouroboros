package workspace

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

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
		LocalPath: &local,
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

// TestLoadIgnoresLegacyCanvasFields 锁定兼容性：旧版本写入的 position 与
// viewport 不再有对应字段，但已有文档仍必须能加载，且保存后不再带出这些字段。
func TestLoadIgnoresLegacyCanvasFields(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "workspace.json")
	raw := `{
		"schema_version": 1,
		"revision": 2,
		"nodes": [
			{"id": "local", "kind": "local", "label": "L", "position": {"x": 80, "y": 160}, "local_path": "/tmp/ourboros-local"}
		],
		"edges": [],
		"viewport": {"x": 10, "y": 20, "zoom": 1.5}
	}`
	if err := os.WriteFile(path, []byte(raw), 0o644); err != nil {
		t.Fatal(err)
	}
	store, err := LoadOrCreate(path, "")
	if err != nil {
		t.Fatal(err)
	}
	doc := store.Get()
	if doc.Revision != 2 || len(doc.Nodes) != 1 || doc.Nodes[0].ID != "local" {
		t.Fatalf("legacy document did not load: %+v", doc)
	}
	encoded, err := json.Marshal(doc)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), "position") || strings.Contains(string(encoded), "viewport") {
		t.Fatalf("legacy canvas fields leaked back out: %s", encoded)
	}
}
