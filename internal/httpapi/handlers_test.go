package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gsxhnd/ourboros/internal/app"
)

func testState(t *testing.T) (*app.State, string) {
	t.Helper()
	dir := t.TempDir()
	local := filepath.Join(dir, "local")
	if err := os.MkdirAll(local, 0o755); err != nil {
		t.Fatal(err)
	}
	state, err := app.New(context.Background(), app.Config{
		DataDir:   dir,
		RcloneBin: filepath.Join(dir, "missing-rclone"),
	})
	if err != nil {
		t.Fatal(err)
	}
	return state, local
}

func send(handler http.Handler, method, target, body string) (int, map[string]any) {
	var reader *strings.Reader
	if body == "" {
		reader = strings.NewReader("")
	} else {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, target, reader)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	payload := map[string]any{}
	if strings.TrimSpace(res.Body.String()) != "" {
		_ = json.Unmarshal(res.Body.Bytes(), &payload)
	}
	return res.Code, payload
}

func TestHealthAndSystemInfoHideRCURL(t *testing.T) {
	state, _ := testState(t)
	handler := Handler(state, "")
	status, _ := send(handler, http.MethodGet, "/health", "")
	if status != http.StatusOK {
		t.Fatal(status)
	}
	status, body := send(handler, http.MethodGet, "/api/system/info", "")
	if status != http.StatusOK {
		t.Fatal(status, body)
	}
	if body["name"] != "ourboros" {
		t.Fatal(body)
	}
	rcloneBody, _ := body["rclone"].(map[string]any)
	if _, ok := rcloneBody["rc_url"]; ok {
		t.Fatal("rc_url leaked")
	}
	if rcloneBody["running"] != false {
		t.Fatal(rcloneBody)
	}
}

func TestWorkspaceRevision(t *testing.T) {
	state, local := testState(t)
	handler := Handler(state, "")
	status, body := send(handler, http.MethodGet, "/api/workspace", "")
	if status != http.StatusOK || body["revision"].(float64) != 0 || body["schema_version"].(float64) != 1 {
		t.Fatal(status, body)
	}
	status, body = send(handler, http.MethodPost, "/api/workspace/nodes", `{
		"revision": 0,
		"kind": "local",
		"label": "Backups",
		"position": {"x": 10, "y": 20},
		"local_path": "`+local+`"
	}`)
	if status != http.StatusCreated || body["revision"].(float64) != 1 {
		t.Fatal(status, body)
	}
	status, body = send(handler, http.MethodPost, "/api/workspace/nodes", `{
		"revision": 0,
		"kind": "local",
		"label": "stale",
		"position": {"x": 1, "y": 1},
		"local_path": "`+local+`"
	}`)
	if status != http.StatusConflict {
		t.Fatal(status, body)
	}
	errBody, _ := body["error"].(map[string]any)
	if errBody["code"] != "workspace_conflict" {
		t.Fatal(body)
	}
}

func TestWorkspaceRejectsTraversalAndIllegalMount(t *testing.T) {
	state, local := testState(t)
	handler := Handler(state, "")
	status, body := send(handler, http.MethodPost, "/api/workspace/nodes", `{
		"revision": 0,
		"kind": "local",
		"label": "bad",
		"position": {"x": 0, "y": 0},
		"local_path": "../etc/passwd"
	}`)
	if status != http.StatusBadRequest {
		t.Fatal(status, body)
	}
	errBody, _ := body["error"].(map[string]any)
	if errBody["code"] != "invalid_path" {
		t.Fatal(body)
	}
	status, _ = send(handler, http.MethodPost, "/api/workspace/nodes", `{
		"revision": 0,
		"id": "local-1",
		"kind": "local",
		"label": "Local",
		"position": {"x": 0, "y": 0},
		"local_path": "`+local+`"
	}`)
	if status != http.StatusCreated {
		t.Fatal(status)
	}
	status, _ = send(handler, http.MethodPost, "/api/workspace/nodes", `{
		"revision": 1,
		"id": "remote-1",
		"kind": "remote",
		"label": "Archive",
		"position": {"x": 100, "y": 0},
		"remote": {"name": "archive", "path": "ourboros"}
	}`)
	if status != http.StatusCreated {
		t.Fatal(status)
	}
	status, body = send(handler, http.MethodPost, "/api/workspace/edges", `{
		"revision": 2,
		"source": "local-1",
		"target": "remote-1",
		"kind": "mount"
	}`)
	if status != http.StatusBadRequest {
		t.Fatal(status, body)
	}
	errBody, _ = body["error"].(map[string]any)
	message, _ := errBody["message"].(string)
	if !strings.Contains(message, "remote source") {
		t.Fatal(body)
	}
}

func TestRCProxyAndFilesRequireRclone(t *testing.T) {
	state, _ := testState(t)
	handler := Handler(state, "")
	status, body := send(handler, http.MethodPost, "/api/rc/config/dump", "{}")
	if status != http.StatusBadRequest {
		t.Fatal(status, body)
	}
	errBody, _ := body["error"].(map[string]any)
	if errBody["code"] != "forbidden_command" {
		t.Fatal(body)
	}
	status, body = send(handler, http.MethodPost, "/api/rc/sync/copy", "{}")
	errBody, _ = body["error"].(map[string]any)
	if status != http.StatusBadRequest || errBody["code"] != "forbidden_command" {
		t.Fatal(status, body)
	}
	status, body = send(handler, http.MethodGet, "/api/files?fs=/tmp&remote=", "")
	errBody, _ = body["error"].(map[string]any)
	if status != http.StatusServiceUnavailable || errBody["code"] != "rclone_unavailable" {
		t.Fatal(status, body)
	}
}

func TestSettingsSchema(t *testing.T) {
	state, _ := testState(t)
	handler := Handler(state, "")
	status, body := send(handler, http.MethodGet, "/api/settings", "")
	if status != http.StatusOK || body["schema_version"].(float64) != 1 || body["auto_start"] != false {
		t.Fatal(status, body)
	}
	if body["rclone_rc_url"] != nil {
		t.Fatal(body["rclone_rc_url"])
	}
	status, body = send(handler, http.MethodPatch, "/api/settings", `{"rclone_rc_url":"http://127.0.0.1:5572"}`)
	if status != http.StatusOK || body["rclone_rc_url"] != "http://127.0.0.1:5572" {
		t.Fatal(status, body)
	}
	status, body = send(handler, http.MethodGet, "/api/settings", "")
	if status != http.StatusOK || body["rclone_rc_url"] != "http://127.0.0.1:5572" {
		t.Fatal(status, body)
	}
}

func TestEmptyJobsAndMissingRclone(t *testing.T) {
	state, _ := testState(t)
	handler := Handler(state, "")
	status, body := send(handler, http.MethodGet, "/api/sync/jobs", "")
	jobs, _ := body["jobs"].([]any)
	if status != http.StatusOK || len(jobs) != 0 {
		t.Fatal(status, body)
	}
	status, body = send(handler, http.MethodGet, "/api/mounts", "")
	mounts, _ := body["mounts"].([]any)
	if status != http.StatusOK || len(mounts) != 0 {
		t.Fatal(status, body)
	}
	status, body = send(handler, http.MethodPost, "/api/rclone/start", "")
	errBody, _ := body["error"].(map[string]any)
	if status != http.StatusServiceUnavailable || errBody["code"] != "rclone_unavailable" {
		t.Fatal(status, body)
	}
}

func TestSpawnedRcloneAllowlist(t *testing.T) {
	if _, err := exec.LookPath("rclone"); err != nil {
		t.Skip("rclone is not installed")
	}
	dir := t.TempDir()
	local := filepath.Join(dir, "local")
	if err := os.MkdirAll(local, 0o755); err != nil {
		t.Fatal(err)
	}
	state, err := app.New(context.Background(), app.Config{
		DataDir:      dir,
		RcloneBin:    "rclone",
		RcloneConfig: filepath.Join(dir, "rclone.conf"),
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(state.Close)
	if _, err := state.Rclone.EnsureRunning(context.Background()); err != nil {
		t.Fatal(err)
	}
	handler := Handler(state, "")
	status, body := send(handler, http.MethodGet, "/api/rclone/status", "")
	if status != http.StatusOK || body["running"] != true || body["mode"] != "spawned" {
		t.Fatal(status, body)
	}
	if _, ok := body["rc_url"]; ok {
		t.Fatal("rc_url leaked")
	}
	endpoint, _ := body["endpoint"].(string)
	if endpoint == "" || strings.Contains(endpoint, "@") || body["os"] == nil || body["version"] == nil {
		t.Fatal("expected public connection details", body)
	}
	status, body = send(handler, http.MethodGet, "/api/remotes/providers", "")
	providers, _ := body["providers"].([]any)
	if status != http.StatusOK || len(providers) == 0 {
		t.Fatal(status, len(providers))
	}
	status, body = send(handler, http.MethodPost, "/api/remotes", `{"name":"disk","type":"alias","parameters":{"remote":"/tmp"}}`)
	if status != http.StatusCreated {
		t.Fatal(status, body)
	}
	status, body = send(handler, http.MethodGet, "/api/remotes", "")
	remotes, _ := body["remotes"].([]any)
	var disk map[string]any
	for _, item := range remotes {
		row, _ := item.(map[string]any)
		if row["name"] == "disk" {
			disk = row
		}
		if _, ok := row["remote"]; ok {
			t.Fatal("list leaked parameters", body)
		}
	}
	if status != http.StatusOK || disk["type"] != "alias" {
		t.Fatal(status, body)
	}
	status, body = send(handler, http.MethodGet, "/api/remotes/disk", "")
	params, _ := body["parameters"].(map[string]any)
	if status != http.StatusOK || body["type"] != "alias" || params["remote"] != "/tmp" {
		t.Fatal(status, body)
	}
	status, body = send(handler, http.MethodPost, "/api/rc/core/version", "{}")
	if status != http.StatusOK || body["version"] == nil {
		t.Fatal(status, body)
	}
	status, _ = send(handler, http.MethodPost, "/api/rc/config/dump", "{}")
	if status != http.StatusBadRequest {
		t.Fatal(status)
	}
	status, body = send(handler, http.MethodGet, "/api/files?fs="+local+"&remote=", "")
	if status != http.StatusOK || body["items"] == nil {
		t.Fatal(status, body)
	}
}
