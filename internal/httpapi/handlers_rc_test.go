package httpapi

import (
	"context"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gsxhnd/ourboros/internal/app"
)

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
