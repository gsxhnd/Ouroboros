package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gsxhnd/ourboros/internal/app"
)

func TestFilesDownloadValidationWithoutRclone(t *testing.T) {
	state, local := testState(t)
	handler := newTestHandler(state)
	status, body := send(handler, http.MethodGet, "/api/files/download?fs="+local+"&remote=", "")
	errBody, _ := body["error"].(map[string]any)
	if status != http.StatusBadRequest || errBody["code"] != "invalid_request" {
		t.Fatal(status, body)
	}
	status, body = send(handler, http.MethodGet, "/api/files/download?fs="+local+"&remote=../etc", "")
	errBody, _ = body["error"].(map[string]any)
	if status != http.StatusBadRequest || errBody["code"] != "invalid_path" {
		t.Fatal(status, body)
	}
	// rclone 无法运行时返回可诊断的不可用错误。
	status, body = send(handler, http.MethodGet, "/api/files/download?fs="+local+"&remote=a.txt", "")
	errBody, _ = body["error"].(map[string]any)
	if status != http.StatusServiceUnavailable || errBody["code"] != "rclone_unavailable" {
		t.Fatal(status, body)
	}
}

func TestFilesDownload(t *testing.T) {
	if _, err := exec.LookPath("rclone"); err != nil {
		t.Skip("rclone is not installed")
	}
	dir := t.TempDir()
	local := filepath.Join(dir, "local")
	if err := os.MkdirAll(filepath.Join(local, "sub"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(local, "hello.txt"), []byte("hello download"), 0o644); err != nil {
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
	handler := newTestHandler(state)

	req := httptest.NewRequest(http.MethodGet, "/api/files/download?fs="+local+"&remote=hello.txt", nil)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatal(res.Code, res.Body.String())
	}
	if res.Body.String() != "hello download" {
		t.Fatalf("downloaded %q", res.Body.String())
	}
	if disposition := res.Header().Get("Content-Disposition"); !strings.Contains(disposition, "attachment") {
		t.Fatal(disposition)
	}
	if lengths := res.Header().Get("Content-Length"); lengths != "14" {
		t.Fatal(lengths)
	}

	// 目录与不存在的文件都要给出明确错误。
	req = httptest.NewRequest(http.MethodGet, "/api/files/download?fs="+local+"&remote=sub", nil)
	res = httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusBadRequest {
		t.Fatal(res.Code, res.Body.String())
	}
	req = httptest.NewRequest(http.MethodGet, "/api/files/download?fs="+local+"&remote=missing.txt", nil)
	res = httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusNotFound {
		t.Fatal(res.Code, res.Body.String())
	}
}
