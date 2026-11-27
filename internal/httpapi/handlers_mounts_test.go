package httpapi

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/gsxhnd/ourboros/internal/app"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

// stateWithMountEdge boots a state whose workspace already holds a remote →
// local mount edge. There is no HTTP route that creates one, so the document
// is written the way an older version of the app would have left it.
func stateWithMountEdge(t *testing.T, edge workspace.Edge, nodes ...workspace.Node) *app.State {
	t.Helper()
	dir := t.TempDir()
	raw, err := json.Marshal(workspace.Document{
		SchemaVersion: workspace.SchemaVersion,
		Nodes:         nodes,
		Edges:         []workspace.Edge{edge},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "workspace.json"), raw, 0o644); err != nil {
		t.Fatal(err)
	}
	state, err := app.New(nil, app.Config{DataDir: dir, RcloneBin: filepath.Join(dir, "missing-rclone")})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(state.Close)
	return state
}

func mountFixture(t *testing.T, binary string) *app.State {
	t.Helper()
	local := filepath.Join(t.TempDir(), "mnt")
	state := stateWithMountEdge(t,
		workspace.Edge{ID: "m1", Source: "src", Target: "dst", Kind: workspace.EdgeMount, Mount: &workspace.MountConfig{Enabled: true}},
		workspace.Node{ID: "src", Kind: workspace.NodeRemote, Label: "src", Remote: &workspace.Remote{Name: "testsuite"}},
		workspace.Node{ID: "dst", Kind: workspace.NodeLocal, Label: "dst", LocalPath: &local},
	)
	if binary != "" {
		state.Rclone.UpdateSettings(func(s *rclone.Settings) { s.Bin = binary })
	}
	return state
}

func TestMountsListShowsStoppedMountEdges(t *testing.T) {
	state := mountFixture(t, "")
	status, body := send(newTestHandler(state), http.MethodGet, "/api/mounts", "")
	mounts, _ := body["mounts"].([]any)
	if status != http.StatusOK || len(mounts) != 1 {
		t.Fatalf("status %d body %v", status, body)
	}
	mount, _ := mounts[0].(map[string]any)
	if mount["edge_id"] != "m1" || mount["status"] != "stopped" {
		t.Fatalf("mount = %v", mount)
	}
}

func TestMountStartAndStopUnknownEdge(t *testing.T) {
	state := mountFixture(t, "")
	handler := newTestHandler(state)
	for _, action := range []string{"start", "stop"} {
		status, body := send(handler, http.MethodPost, "/api/mounts/nope/"+action, "")
		if status != http.StatusNotFound || errorCode(body) != "not_found" {
			t.Errorf("%s unknown edge: status %d body %v", action, status, body)
		}
	}
}

func TestMountStartReportsMissingBinary(t *testing.T) {
	state := mountFixture(t, "")
	status, body := send(newTestHandler(state), http.MethodPost, "/api/mounts/m1/start", "")
	if status != http.StatusServiceUnavailable || errorCode(body) != "rclone_unavailable" {
		t.Fatalf("status %d body %v", status, body)
	}
}

func TestMountStartRejectsASyncEdge(t *testing.T) {
	state := stateWithMountEdge(t,
		workspace.Edge{ID: "s1", Source: "src", Target: "dst", Kind: workspace.EdgeSync, Sync: &workspace.SyncConfig{}},
		workspace.Node{ID: "src", Kind: workspace.NodeRemote, Label: "src", Remote: &workspace.Remote{Name: "testsuite"}},
		workspace.Node{ID: "dst", Kind: workspace.NodeLocal, Label: "dst", LocalPath: ptr(t.TempDir())},
	)
	status, body := send(newTestHandler(state), http.MethodPost, "/api/mounts/s1/start", "")
	if status != http.StatusBadRequest || errorCode(body) != "invalid_request" {
		t.Fatalf("status %d body %v", status, body)
	}
}

func TestMountLifecycleOverHTTP(t *testing.T) {
	script := filepath.Join(t.TempDir(), "fake-rclone")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nexec sleep 30\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	state := mountFixture(t, script)
	handler := newTestHandler(state)

	status, body := send(handler, http.MethodPost, "/api/mounts/m1/start", "")
	if status != http.StatusOK || body["status"] != "mounted" {
		t.Fatalf("start: status %d body %v", status, body)
	}
	status, body = send(handler, http.MethodPost, "/api/mounts/m1/start", "")
	if status != http.StatusConflict || errorCode(body) != "conflict" {
		t.Fatalf("second start: status %d body %v", status, body)
	}
	_, listed := send(handler, http.MethodGet, "/api/mounts", "")
	if mounts, _ := listed["mounts"].([]any); len(mounts) != 1 || mounts[0].(map[string]any)["status"] != "mounted" {
		t.Fatalf("list while mounted: %v", listed)
	}
	status, body = send(handler, http.MethodPost, "/api/mounts/m1/stop", "")
	if status != http.StatusOK || body["status"] != "stopped" {
		t.Fatalf("stop: status %d body %v", status, body)
	}
}

func ptr[T any](v T) *T { return &v }

// A storage node that a mount edge points at can never be deleted, whether or
// not that mount is running: the workspace refuses any node an edge still
// references. That is what protects a live mount's directory, so there is no
// separate "is it busy" check on this route.
func TestNodeReferencedByAMountEdgeCannotBeDeleted(t *testing.T) {
	script := filepath.Join(t.TempDir(), "fake-rclone")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nexec sleep 30\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	state := mountFixture(t, script)
	handler := newTestHandler(state)

	check := func(when string) {
		t.Helper()
		revision := strconv.FormatUint(state.Workspace.Get().Revision, 10)
		status, body := send(handler, http.MethodDelete, "/api/workspace/nodes/dst?revision="+revision, "")
		if status != http.StatusConflict {
			t.Fatalf("%s: status %d body %v", when, status, body)
		}
		details := body["error"].(map[string]any)["details"].(map[string]any)
		if details["kind"] != "node_in_use" {
			t.Fatalf("%s: details = %v", when, details)
		}
		if state.Workspace.Get().Node("dst") == nil {
			t.Fatalf("%s: the node was deleted", when)
		}
	}
	check("while stopped")
	if status, body := send(handler, http.MethodPost, "/api/mounts/m1/start", ""); status != http.StatusOK {
		t.Fatalf("start: %d %v", status, body)
	}
	check("while mounted")
}
