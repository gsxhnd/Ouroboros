package httpapi

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gsxhnd/ourboros/internal/core"
)

func TestDecodeJSONRejectsTrailingContent(t *testing.T) {
	r := httptest.NewRequest("POST", "/x", strings.NewReader(`{"a":1} {"b":2}`))
	var body map[string]any
	err := decodeJSON(r, &body)
	if err == nil {
		t.Fatal("expected error for trailing content")
	}
	if !strings.Contains(err.Error(), "trailing") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestDecodeJSONRejectsOversizedBody(t *testing.T) {
	r := httptest.NewRequest("POST", "/x", strings.NewReader(`{"a":1}`))
	r.Header.Set("Content-Length", "99999999")
	var body map[string]any
	err := decodeJSON(r, &body)
	if err == nil || !strings.Contains(err.Error(), "too large") {
		t.Fatalf("expected body-size error, got %v", err)
	}
}

func TestDecodeJSONAcceptsNormalBody(t *testing.T) {
	r := httptest.NewRequest("POST", "/x", strings.NewReader(`{"a":1}`))
	var body struct {
		A int `json:"a"`
	}
	if err := decodeJSON(r, &body); err != nil {
		t.Fatal(err)
	}
	if body.A != 1 {
		t.Fatalf("a=%d", body.A)
	}
}

func TestMapCoreConflictDetails(t *testing.T) {
	err := core.ConflictDetail("stale", map[string]any{
		"kind":     "workspace_revision",
		"expected": uint64(7),
		"found":    uint64(9),
	})
	status, code, details := mapCore(err)
	if status != 409 || code != "workspace_conflict" {
		t.Fatalf("status=%d code=%s", status, code)
	}
	mapped := details.(map[string]any)
	if mapped["expected"] != uint64(7) || mapped["found"] != uint64(9) {
		t.Fatalf("details %v", mapped)
	}
}

func TestMapCoreConflictWithoutRevisionIsPlainConflict(t *testing.T) {
	// Info level: a message that merely contains the word "found" used to be
	// string-matched into conflict details; it must be a plain conflict now.
	status, code, details := mapCore(core.Conflict("edge edge-1 already exists"))
	if status != 409 || code != "conflict" {
		t.Fatalf("status=%d code=%s", status, code)
	}
	if details == nil {
		t.Fatal("details must not be nil")
	}
}

func TestCheckBodySizeFromHeaderOnly(t *testing.T) {
	r := httptest.NewRequest("POST", "/x", strings.NewReader(`{}`))
	r.Header.Set("Content-Length", "10")
	if err := checkBodySize(r); err != nil {
		t.Fatal(err)
	}
	r.Header.Set("Content-Length", "99999999")
	if err := checkBodySize(r); err == nil {
		t.Fatal("expected error for oversized content-length")
	}
}

// API 错误体必须附带结构化的 details.kind，前端据此本地化，不再依赖英文原文。
func TestMapCoreForwardStructuredKind(t *testing.T) {
	_, _, details := mapCore(core.NotRunning())
	mapped, ok := details.(map[string]any)
	if !ok {
		t.Fatalf("details type %T", details)
	}
	if mapped["kind"] != "rclone_not_running" {
		t.Fatalf("kind = %v", mapped["kind"])
	}
}

func TestValidRemoteName(t *testing.T) {
	for _, good := range []string{"gdrive", "my-drive", "drive_1", "UPPER", "a.b"} {
		if !validRemoteName(good) {
			t.Errorf("validRemoteName(%q) = false", good)
		}
	}
	for _, bad := range []string{"drive:", "d:rive", " drive", "drive ", "a b", "", "a/b", "a\\b", "a\v b"} {
		if validRemoteName(bad) {
			t.Errorf("validRemoteName(%q) = true", bad)
		}
	}
}
