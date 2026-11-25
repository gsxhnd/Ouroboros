package persist

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAtomicWriteCreatesParentsAndReplaces(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "dir", "file.json")
	if err := AtomicWrite(path, []byte("one")); err != nil {
		t.Fatal(err)
	}
	if err := AtomicWrite(path, []byte("two")); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(path)
	if err != nil || string(got) != "two" {
		t.Fatalf("read = (%q, %v)", got, err)
	}
}

func TestAtomicWriteLeavesNoTempFiles(t *testing.T) {
	dir := t.TempDir()
	for i := 0; i < 3; i++ {
		if err := AtomicWrite(filepath.Join(dir, "f.json"), []byte("x")); err != nil {
			t.Fatal(err)
		}
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].Name() != "f.json" {
		var names []string
		for _, e := range entries {
			names = append(names, e.Name())
		}
		t.Fatalf("directory has stray files: %v", names)
	}
}

func TestAtomicWriteFailureKeepsOriginal(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "f.json")
	if err := AtomicWrite(path, []byte("keep")); err != nil {
		t.Fatal(err)
	}
	// A directory squatting on the target makes the final rename fail.
	blocked := filepath.Join(dir, "blocked")
	if err := os.MkdirAll(filepath.Join(blocked, "child"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := AtomicWrite(blocked, []byte("nope")); err == nil {
		t.Fatal("expected writing over a non-empty directory to fail")
	}
	if got, _ := os.ReadFile(path); string(got) != "keep" {
		t.Fatalf("unrelated file changed: %q", got)
	}
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".tmp") {
			t.Fatalf("temp file left behind: %s", e.Name())
		}
	}
}

func TestAtomicWriteJSONIsIndentedWithTrailingNewline(t *testing.T) {
	path := filepath.Join(t.TempDir(), "f.json")
	if err := AtomicWriteJSON(path, map[string]int{"a": 1}); err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(path)
	if string(got) != "{\n  \"a\": 1\n}\n" {
		t.Fatalf("content = %q", got)
	}
}

func TestAtomicWriteJSONRejectsUnserialisableValue(t *testing.T) {
	path := filepath.Join(t.TempDir(), "f.json")
	if err := AtomicWriteJSON(path, make(chan int)); err == nil {
		t.Fatal("expected a serialisation error")
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("file must not be created on failure: %v", err)
	}
}

func TestDefaultDataDirHonoursEnv(t *testing.T) {
	t.Setenv("OURBOROS_DATA_DIR", "/custom/data")
	if got := DefaultDataDir(); got != "/custom/data" {
		t.Fatalf("got %q", got)
	}
}
