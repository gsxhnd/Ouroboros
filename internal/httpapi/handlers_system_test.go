package httpapi

import (
	"net/http"
	"testing"
)

func TestHealthAndSystemInfoHideRCURL(t *testing.T) {
	state, _ := testState(t)
	handler := newTestHandler(state)
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
