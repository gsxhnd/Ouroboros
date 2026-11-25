package httpapi

import (
	"net/http"
	"testing"
)

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
