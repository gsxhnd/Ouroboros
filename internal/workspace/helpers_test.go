package workspace

import (
	"os"
	"path/filepath"
	"testing"
)

func localNode(id, path string) Node {
	return Node{ID: id, Kind: NodeLocal, Label: id, LocalPath: &path}
}

func remoteNode(id, name string) Node {
	return Node{ID: id, Kind: NodeRemote, Label: id, Remote: &Remote{Name: name}}
}

func ptrSync(config SyncConfig) *SyncConfig { return &config }

func ptrDoc(doc Document) *Document { return &doc }

func tempLocalDir(t *testing.T) string {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "data")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	return dir
}

func newTaskStore(t *testing.T) *Store {
	t.Helper()
	path := filepath.Join(t.TempDir(), "workspace.json")
	store, err := LoadOrCreate(path, "")
	if err != nil {
		t.Fatal(err)
	}
	return store
}

func ptrOperation(op Operation) *Operation { return &op }

func ptrString(s string) *string { return &s }

func ptrEndpoint(e TaskEndpoint) *TaskEndpoint { return &e }
