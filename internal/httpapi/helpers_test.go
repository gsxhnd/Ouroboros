package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gsxhnd/ourboros/internal/app"
	"github.com/gsxhnd/ourboros/internal/service"
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

func newTestHandler(state *app.State, webDir ...string) http.Handler {
	dir := ""
	if len(webDir) > 0 {
		dir = webDir[0]
	}
	return Handler(service.New(state), dir)
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
