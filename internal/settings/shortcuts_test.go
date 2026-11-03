package settings

import (
	"path/filepath"
	"testing"
)

func TestResolvedShortcutsFallBackToDefaults(t *testing.T) {
	doc := DefaultDocument()
	doc.Shortcuts = map[string]string{"show_main": "CmdOrCtrl+Shift+M"}
	got := doc.ResolvedShortcuts()
	if got["show_main"] != "CmdOrCtrl+Shift+M" {
		t.Fatalf("override = %q", got["show_main"])
	}
	if got["quit"] != DefaultShortcuts["quit"] {
		t.Fatalf("quit = %q, want default", got["quit"])
	}
}

func TestPatchShortcutsMergesAndResets(t *testing.T) {
	store, err := LoadOrCreate(filepath.Join(t.TempDir(), "settings.json"))
	if err != nil {
		t.Fatal(err)
	}
	doc, err := store.Patch(Patch{Shortcuts: map[string]string{"toggle_panel": "Ctrl+Alt+P"}})
	if err != nil {
		t.Fatal(err)
	}
	if doc.Shortcuts["toggle_panel"] != "Ctrl+Alt+P" {
		t.Fatalf("stored = %q", doc.Shortcuts["toggle_panel"])
	}
	doc, err = store.Patch(Patch{Shortcuts: map[string]string{"toggle_panel": ""}})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := doc.Shortcuts["toggle_panel"]; ok {
		t.Fatal("empty value should reset to default")
	}
}

func TestPatchShortcutsRejectsUnknownActionAndBadAccelerator(t *testing.T) {
	store, err := LoadOrCreate(filepath.Join(t.TempDir(), "settings.json"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Patch(Patch{Shortcuts: map[string]string{"nope": "Ctrl+X"}}); err == nil {
		t.Fatal("unknown action should be rejected")
	}
	if _, err := store.Patch(Patch{Shortcuts: map[string]string{"quit": "Hyper+X"}}); err == nil {
		t.Fatal("unknown modifier should be rejected")
	}
	if _, err := store.Patch(Patch{Shortcuts: map[string]string{"quit": "Ctrl+"}}); err == nil {
		t.Fatal("missing key should be rejected")
	}
}
