package rclone

import (
	"errors"
	"testing"

	"github.com/gsxhnd/ourboros/internal/core"
)

func TestResponseErrIsNilOnSuccess(t *testing.T) {
	if err := (Response{Status: 200}).Err("fallback"); err != nil {
		t.Fatalf("err = %v", err)
	}
}

func TestResponseErrUsesUpstreamMessageWithoutTransportPrefix(t *testing.T) {
	err := Response{Status: 500, Body: map[string]any{"error": "directory not found"}}.Err("fallback")
	var coreErr *core.Error
	if !errors.As(err, &coreErr) || coreErr.Kind != core.KindTransport {
		t.Fatalf("err = %#v", err)
	}
	if coreErr.Message != "directory not found" {
		t.Fatalf("message = %q, must not gain the 'failed to contact rclone' prefix", coreErr.Message)
	}
}

func TestResponseErrFallsBackWhenBodyHasNoMessage(t *testing.T) {
	for name, body := range map[string]map[string]any{
		"nil body":   nil,
		"empty":      {},
		"empty text": {"error": ""},
		"non-string": {"error": 42},
	} {
		err := Response{Status: 500, Body: body}.Err("rclone operation failed")
		if err == nil || err.Error() != "rclone operation failed" {
			t.Errorf("%s: err = %v", name, err)
		}
	}
}
