package webui

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRequireMissingDirectory(t *testing.T) {
	_, err := Require("/definitely-not-an-ourboros-webui")
	if err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatal(err)
	}
}

func TestRequireMissingIndex(t *testing.T) {
	dir := t.TempDir()
	_, err := Require(dir)
	if err == nil || !strings.Contains(err.Error(), "index.html") {
		t.Fatal(err)
	}
}

func TestRequireAcceptsIndex(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html></html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	resolved, err := Require(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(resolved, "index.html")); err != nil {
		t.Fatal(err)
	}
}
