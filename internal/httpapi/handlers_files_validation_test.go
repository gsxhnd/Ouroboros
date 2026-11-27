package httpapi

import (
	"net/http"
	"testing"
)

// The file endpoints validate their input before they ever reach rclone, so
// these run without it: a bad request must come back as 400 with the matching
// error code, never as the 503 a well-formed request gets when rclone is down.
func TestFileWritesRejectBadInputBeforeReachingRclone(t *testing.T) {
	state, local := testState(t)
	handler := newTestHandler(state)

	cases := []struct {
		name   string
		method string
		target string
		body   string
		code   string
	}{
		{"mkdir without fs", http.MethodPost, "/api/files/mkdir", `{"remote":"x"}`, "invalid_path"},
		{"mkdir with traversal", http.MethodPost, "/api/files/mkdir", `{"fs":"` + local + `","remote":"../escape"}`, "invalid_path"},
		{"mkdir with a relative local fs", http.MethodPost, "/api/files/mkdir", `{"fs":"./relative","remote":"x"}`, "invalid_path"},
		{"mkdir with a malformed remote name", http.MethodPost, "/api/files/mkdir", `{"fs":"bad name:","remote":"x"}`, "invalid_path"},
		{"mkdir with broken JSON", http.MethodPost, "/api/files/mkdir", `{not json`, "invalid_request"},
		{"copy without a destination", http.MethodPost, "/api/files/copy", `{"src_fs":"` + local + `","src_remote":"a"}`, "invalid_path"},
		{"copy with traversal in the source", http.MethodPost, "/api/files/copy", `{"src_fs":"` + local + `","src_remote":"../a","dst_fs":"` + local + `"}`, "invalid_path"},
		{"move with traversal in the destination", http.MethodPost, "/api/files/move", `{"src_fs":"` + local + `","src_remote":"a","dst_fs":"` + local + `","dst_remote":"../../etc"}`, "invalid_path"},
		{"move with broken JSON", http.MethodPost, "/api/files/move", `[`, "invalid_request"},
		{"delete without fs", http.MethodDelete, "/api/files?remote=x", "", "invalid_request"},
		{"delete with traversal", http.MethodDelete, "/api/files?fs=" + local + "&remote=../escape", "", "invalid_path"},
		{"purge with traversal", http.MethodDelete, "/api/files?fs=" + local + "&remote=../escape&purge=true", "", "invalid_path"},
	}
	for _, tc := range cases {
		status, body := send(handler, tc.method, tc.target, tc.body)
		errBody, _ := body["error"].(map[string]any)
		if status != http.StatusBadRequest || errBody["code"] != tc.code {
			t.Errorf("%s: status %d code %v, want 400 %s (body %v)", tc.name, status, errBody["code"], tc.code, body)
		}
	}
}

func TestFileWritesReachRcloneOnlyWhenInputIsValid(t *testing.T) {
	state, local := testState(t)
	handler := newTestHandler(state)

	for _, tc := range []struct {
		name, method, target, body string
	}{
		{"mkdir", http.MethodPost, "/api/files/mkdir", `{"fs":"` + local + `","remote":"new"}`},
		{"copy", http.MethodPost, "/api/files/copy", `{"src_fs":"` + local + `","src_remote":"a","dst_fs":"` + local + `","dst_remote":"b"}`},
		{"move", http.MethodPost, "/api/files/move", `{"src_fs":"` + local + `","src_remote":"a","dst_fs":"` + local + `","dst_remote":"b"}`},
		{"delete", http.MethodDelete, "/api/files?fs=" + local + "&remote=a", ""},
	} {
		status, body := send(handler, tc.method, tc.target, tc.body)
		errBody, _ := body["error"].(map[string]any)
		if status != http.StatusServiceUnavailable || errBody["code"] != "rclone_unavailable" {
			t.Errorf("%s: status %d code %v, want 503 rclone_unavailable (body %v)", tc.name, status, errBody["code"], body)
		}
	}
}
