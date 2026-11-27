package httpapi

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gsxhnd/ourboros/internal/app"
	"github.com/gsxhnd/ourboros/internal/rclone"
)

// installManaged drops a stand-in rclone into the managed versions directory,
// exactly where a finished download would leave it.
func installManaged(t *testing.T, state *app.State, version string) string {
	t.Helper()
	path := rclone.ManagedBinaryPath(state.VersionsDir(), version)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("#!/bin/sh\necho 'rclone v1.0.0'\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

func errorCode(body map[string]any) any {
	errBody, _ := body["error"].(map[string]any)
	return errBody["code"]
}

func TestSelectManagedVersionRecordsTheChoice(t *testing.T) {
	state, _ := testState(t)
	handler := newTestHandler(state)
	path := installManaged(t, state, "v1.70.0")

	status, body := send(handler, http.MethodPost, "/api/rclone/select", `{"source":"managed","version":"v1.70.0"}`)
	if status != http.StatusOK {
		t.Fatalf("status %d body %v", status, body)
	}
	if got := state.Rclone.SelectedBin(); got != path {
		t.Fatalf("supervisor binary = %q, want %q", got, path)
	}
	doc := state.Settings.Get()
	if doc.RcloneSource != "managed" || doc.RcloneBin == nil || *doc.RcloneBin != path {
		t.Fatalf("settings not updated: %+v", doc)
	}
}

func TestSelectCustomPath(t *testing.T) {
	state, local := testState(t)
	handler := newTestHandler(state)
	custom := filepath.Join(local, "my-rclone")
	if err := os.WriteFile(custom, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	status, body := send(handler, http.MethodPost, "/api/rclone/select", `{"source":"custom","path":"`+custom+`"}`)
	if status != http.StatusOK || state.Rclone.SelectedBin() != custom {
		t.Fatalf("status %d bin %q body %v", status, state.Rclone.SelectedBin(), body)
	}
}

func TestSelectRejectsBadRequests(t *testing.T) {
	state, local := testState(t)
	handler := newTestHandler(state)
	before := state.Rclone.SelectedBin()
	cases := []struct {
		name, body string
		status     int
		code       any
	}{
		{"managed without a version", `{"source":"managed"}`, http.StatusBadRequest, "invalid_request"},
		{"custom without a path", `{"source":"custom"}`, http.StatusBadRequest, "invalid_request"},
		{"version that escapes the versions dir", `{"source":"managed","version":"../../etc"}`, http.StatusBadRequest, "invalid_request"},
		{"managed version that is not installed", `{"source":"managed","version":"v9.9.9"}`, http.StatusServiceUnavailable, "rclone_unavailable"},
		{"custom path that does not exist", `{"source":"custom","path":"` + filepath.Join(local, "nope") + `"}`, http.StatusServiceUnavailable, "rclone_unavailable"},
		{"broken JSON", `{`, http.StatusBadRequest, "invalid_request"},
	}
	for _, tc := range cases {
		status, body := send(handler, http.MethodPost, "/api/rclone/select", tc.body)
		if status != tc.status || errorCode(body) != tc.code {
			t.Errorf("%s: status %d code %v, want %d %v (body %v)", tc.name, status, errorCode(body), tc.status, tc.code, body)
		}
	}
	if state.Rclone.SelectedBin() != before {
		t.Fatal("a rejected selection changed the active binary")
	}
}

func TestActivateInstalledVersion(t *testing.T) {
	state, _ := testState(t)
	handler := newTestHandler(state)
	path := installManaged(t, state, "v1.71.0")

	status, body := send(handler, http.MethodPost, "/api/rclone/versions/v1.71.0/activate", "")
	if status != http.StatusOK || state.Rclone.SelectedBin() != path {
		t.Fatalf("status %d bin %q body %v", status, state.Rclone.SelectedBin(), body)
	}
	if doc := state.Settings.Get(); doc.RcloneSource != "managed" {
		t.Fatalf("source = %q", doc.RcloneSource)
	}
}

func TestActivateRejectsMissingAndUnsafeVersions(t *testing.T) {
	state, _ := testState(t)
	handler := newTestHandler(state)
	before := state.Rclone.SelectedBin()

	status, body := send(handler, http.MethodPost, "/api/rclone/versions/v9.9.9/activate", "")
	if status != http.StatusNotFound || errorCode(body) != "not_found" {
		t.Fatalf("missing version: status %d body %v", status, body)
	}
	// A directory squatting where the binary should be is not a binary.
	dir := rclone.ManagedBinaryPath(state.VersionsDir(), "v1.72.0")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	status, _ = send(handler, http.MethodPost, "/api/rclone/versions/v1.72.0/activate", "")
	if status != http.StatusNotFound {
		t.Fatalf("directory in place of a binary: status %d", status)
	}
	status, body = send(handler, http.MethodPost, "/api/rclone/versions/..%2F..%2Fetc/activate", "")
	if status == http.StatusOK {
		t.Fatalf("path traversal was accepted: %v", body)
	}
	if state.Rclone.SelectedBin() != before {
		t.Fatal("a rejected activation changed the active binary")
	}
}

func TestDeleteVersionRemovesItsDirectory(t *testing.T) {
	state, _ := testState(t)
	handler := newTestHandler(state)
	installManaged(t, state, "v1.73.0")
	keep := installManaged(t, state, "v1.74.0")

	status, _ := send(handler, http.MethodDelete, "/api/rclone/versions/v1.73.0", "")
	if status != http.StatusNoContent {
		t.Fatalf("status %d", status)
	}
	if _, err := os.Stat(filepath.Join(state.VersionsDir(), "v1.73.0")); !os.IsNotExist(err) {
		t.Fatal("version directory still exists")
	}
	if _, err := os.Stat(keep); err != nil {
		t.Fatalf("an unrelated version was removed: %v", err)
	}
	if status, body := send(handler, http.MethodDelete, "/api/rclone/versions/v1.73.0", ""); status != http.StatusNotFound || errorCode(body) != "not_found" {
		t.Fatalf("deleting twice: status %d body %v", status, body)
	}
}

func TestDeletingTheActiveVersionFallsBackToSystemRclone(t *testing.T) {
	state, _ := testState(t)
	handler := newTestHandler(state)
	installManaged(t, state, "v1.75.0")
	if status, body := send(handler, http.MethodPost, "/api/rclone/versions/v1.75.0/activate", ""); status != http.StatusOK {
		t.Fatalf("activate: %d %v", status, body)
	}

	status, _ := send(handler, http.MethodDelete, "/api/rclone/versions/v1.75.0", "")
	if status != http.StatusNoContent {
		t.Fatalf("status %d", status)
	}
	if got := state.Rclone.SelectedBin(); got != "rclone" {
		t.Fatalf("active binary after deleting it = %q, want the system rclone", got)
	}
	doc := state.Settings.Get()
	if doc.RcloneSource != "system" || doc.RcloneBin != nil {
		t.Fatalf("settings still point at the deleted version: %+v", doc)
	}
}

func TestDeletingAnInactiveVersionKeepsTheActiveBinary(t *testing.T) {
	state, _ := testState(t)
	handler := newTestHandler(state)
	installManaged(t, state, "v1.76.0")
	active := installManaged(t, state, "v1.77.0")
	if status, _ := send(handler, http.MethodPost, "/api/rclone/versions/v1.77.0/activate", ""); status != http.StatusOK {
		t.Fatal("activate failed")
	}
	if status, _ := send(handler, http.MethodDelete, "/api/rclone/versions/v1.76.0", ""); status != http.StatusNoContent {
		t.Fatal("delete failed")
	}
	if got := state.Rclone.SelectedBin(); got != active {
		t.Fatalf("active binary changed to %q", got)
	}
}

func TestScanListsManagedInstalls(t *testing.T) {
	state, _ := testState(t)
	handler := newTestHandler(state)
	installManaged(t, state, "v1.78.0")

	status, body := send(handler, http.MethodPost, "/api/rclone/scan", "")
	if status != http.StatusOK {
		t.Fatalf("status %d body %v", status, body)
	}
	candidates, _ := body["candidates"].([]any)
	found := false
	for _, item := range candidates {
		candidate, _ := item.(map[string]any)
		if path, _ := candidate["path"].(string); strings.Contains(path, "v1.78.0") && candidate["source"] == "managed" {
			found = true
		}
	}
	if !found {
		t.Fatalf("installed version missing from scan: %v", candidates)
	}
}

func TestDownloadEndpointsRejectBadInput(t *testing.T) {
	state, _ := testState(t)
	handler := newTestHandler(state)

	status, body := send(handler, http.MethodPost, "/api/rclone/downloads", `{"version":"../../x"}`)
	if status != http.StatusBadRequest || errorCode(body) != "invalid_request" {
		t.Fatalf("unsafe version: status %d body %v", status, body)
	}
	status, body = send(handler, http.MethodPost, "/api/rclone/downloads", `{`)
	if status != http.StatusBadRequest {
		t.Fatalf("broken JSON: status %d body %v", status, body)
	}
	status, body = send(handler, http.MethodPost, "/api/rclone/downloads/no-such-id/cancel", "")
	if status != http.StatusNotFound || errorCode(body) != "not_found" {
		t.Fatalf("cancelling an unknown download: status %d body %v", status, body)
	}
}
