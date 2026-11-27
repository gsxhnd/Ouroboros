package service

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/gsxhnd/ourboros/internal/rclone"
)

func TestDeletingActiveManagedVersionFallsBackToSystem(t *testing.T) {
	_, state, svcs, _ := newTestServices(t)
	path := rclone.ManagedBinaryPath(state.VersionsDir(), "v1.75.0")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	if _, err := svcs.Rclone.Activate("v1.75.0"); err != nil {
		t.Fatalf("activate: %v", err)
	}
	if err := svcs.Rclone.DeleteVersion("v1.75.0"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if got := state.Rclone.SelectedBin(); got != "rclone" {
		t.Fatalf("selected binary = %q, want system rclone", got)
	}
	doc := state.Settings.Get()
	if doc.RcloneSource != "system" || doc.RcloneBin != nil {
		t.Fatalf("settings still reference the deleted binary: %+v", doc)
	}
}
