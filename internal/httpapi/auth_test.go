package httpapi

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gsxhnd/ourboros/internal/app"
)

func authState(t *testing.T, token string) *app.State {
	t.Helper()
	state, _ := testState(t)
	state.AuthToken = token
	return state
}

func TestAuthDisabledOnLoopback(t *testing.T) {
	handler := newTestHandler(authState(t, ""))
	status, _ := send(handler, http.MethodGet, "/api/system/info", "")
	if status != http.StatusOK {
		t.Fatal(status)
	}
}

func TestAuthRejectsMissingToken(t *testing.T) {
	handler := newTestHandler(authState(t, "secret"))
	status, body := send(handler, http.MethodGet, "/api/system/info", "")
	if status != http.StatusUnauthorized {
		t.Fatal(status, body)
	}
	if body["error"].(map[string]any)["code"] != "unauthorized" {
		t.Fatal(body)
	}
}

func TestAuthAcceptsBearerHeader(t *testing.T) {
	handler := newTestHandler(authState(t, "secret"))
	req := httptest.NewRequest(http.MethodGet, "/api/system/info", nil)
	req.Header.Set("Authorization", "Bearer secret")
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatal(res.Code, res.Body.String())
	}
}

func TestAuthRejectsWrongToken(t *testing.T) {
	handler := newTestHandler(authState(t, "secret"))
	req := httptest.NewRequest(http.MethodGet, "/api/system/info", nil)
	req.Header.Set("Authorization", "Bearer nope")
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatal(res.Code)
	}
}

func TestAuthAcceptsQueryTokenForEventSource(t *testing.T) {
	handler := newTestHandler(authState(t, "secret"))
	// EventSource 无法设置请求头，SSE 通过 access_token 查询参数携带 token；
	// 任意一个普通的 GET API 都能验证这条路径。
	req := httptest.NewRequest(http.MethodGet, "/api/system/info?access_token=secret", nil)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatal(res.Code, res.Body.String())
	}
}

func TestHealthStaysOpenWithAuth(t *testing.T) {
	handler := newTestHandler(authState(t, "secret"))
	status, _ := send(handler, http.MethodGet, "/health", "")
	if status != http.StatusOK {
		t.Fatal(status)
	}
}

func TestAuthRejectsForeignOrigin(t *testing.T) {
	handler := newTestHandler(authState(t, "secret"))
	req := httptest.NewRequest(http.MethodGet, "/api/system/info?access_token=secret", nil)
	req.Header.Set("Origin", "https://evil.example")
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatal(res.Code, res.Body.String())
	}
}

func TestAuthAllowsSameHostOrigin(t *testing.T) {
	handler := newTestHandler(authState(t, "secret"))
	req := httptest.NewRequest(http.MethodGet, "/api/system/info", nil)
	req.Header.Set("Origin", "http://127.0.0.1:8080")
	req.Header.Set("Authorization", "Bearer secret")
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatal(res.Code, res.Body.String())
	}
}

func TestAuthAllowsConfiguredOrigin(t *testing.T) {
	state := authState(t, "secret")
	state.Origins = []string{"http://127.0.0.1:1420"}
	handler := newTestHandler(state)
	req := httptest.NewRequest(http.MethodGet, "/api/system/info", nil)
	req.Header.Set("Origin", "http://127.0.0.1:1420")
	req.Header.Set("Authorization", "Bearer secret")
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatal(res.Code, res.Body.String())
	}
}

func TestServesUIWithoutToken(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html></html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	handler := newTestHandler(authState(t, "secret"), dir)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatal(res.Code)
	}
}
