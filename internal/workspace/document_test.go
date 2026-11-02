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
	doc.Edges = append(doc.Edges, Edge{
		ID: "e2", Source: "remote", Target: "local", Kind: EdgeSync,
		Sync: ptrSync(DefaultSync(OpCopy)),
	})
	if err := Validate(&doc, nil, false, ""); err == nil {
		t.Fatal("expected duplicate edge to fail")
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

func localNode(id, path string) Node {
	return Node{ID: id, Kind: NodeLocal, Label: id, LocalPath: &path}
}

func remoteNode(id, name string) Node {
	return Node{ID: id, Kind: NodeRemote, Label: id, Remote: &Remote{Name: name}}
}

func ptrSync(config SyncConfig) *SyncConfig { return &config }
