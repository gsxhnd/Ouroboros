package httpapi

import (
	"testing"

	"github.com/gsxhnd/ourboros/internal/core"
)

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
	mapped := details.(map[string]any)
	if mapped["message"] != "edge edge-1 already exists" {
		t.Fatalf("ordinary conflicts must retain details.message: %v", mapped)
	}
}

func TestMapCoreConflictDetailExact(t *testing.T) {
	err := core.ConflictDetailExact("sync task is disabled", map[string]any{})
	status, code, details := mapCore(err)
	if status != 409 || code != "conflict" {
		t.Fatalf("status=%d code=%s", status, code)
	}
	mapped := details.(map[string]any)
	if len(mapped) != 0 {
		t.Fatalf("details changed: %v", mapped)
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
