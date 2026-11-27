package httpapi

import (
	"encoding/json"
	"net/http"
	"testing"
)

func TestEmptyJobsAndMissingRclone(t *testing.T) {
	state, _ := testState(t)
	handler := newTestHandler(state)
	status, body := send(handler, http.MethodGet, "/api/sync/jobs", "")
	jobs, _ := body["jobs"].([]any)
	if status != http.StatusOK || len(jobs) != 0 {
		t.Fatal(status, body)
	}
	status, body = send(handler, http.MethodGet, "/api/mounts", "")
	mounts, _ := body["mounts"].([]any)
	if status != http.StatusOK || len(mounts) != 0 {
		t.Fatal(status, body)
	}
	status, body = send(handler, http.MethodPost, "/api/rclone/start", "")
	errBody, _ := body["error"].(map[string]any)
	if status != http.StatusServiceUnavailable || errBody["code"] != "rclone_unavailable" {
		t.Fatal(status, body)
	}
}

func createTask(t *testing.T, handler http.Handler, local string, revision int, mutate func(map[string]any)) (int, map[string]any) {
	t.Helper()
	body := map[string]any{
		"revision":  revision,
		"name":      "backup",
		"operation": "sync",
		"source":    map[string]any{"kind": "local", "path": local},
		"target":    map[string]any{"kind": "remote", "remote": "archive", "path": "docs"},
		"bw_limit":  "10MiB",
	}
	if mutate != nil {
		mutate(body)
	}
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	return send(handler, http.MethodPost, "/api/sync/tasks", string(raw))
}

func TestSyncTaskCRUD(t *testing.T) {
	state, local := testState(t)
	handler := newTestHandler(state)

	status, body := createTask(t, handler, local, 0, nil)
	if status != http.StatusCreated {
		t.Fatalf("create: %d %v", status, body)
	}
	task, _ := body["task"].(map[string]any)
	if task["name"] != "backup" || task["operation"] != "sync" {
		t.Fatalf("unexpected task %v", task)
	}
	if task["bw_limit"] != "10MiB" {
		t.Fatalf("bw_limit missing %v", task)
	}
	if task["destructive"] != true {
		t.Fatal("sync must be destructive")
	}
	if task["impact"] == "" {
		t.Fatal("impact text missing")
	}
	taskID, _ := task["id"].(string)
	if taskID == "" {
		t.Fatal("task id missing")
	}

	status, body = send(handler, http.MethodGet, "/api/sync/tasks", "")
	if status != http.StatusOK {
		t.Fatalf("list: %d %v", status, body)
	}
	tasks, _ := body["tasks"].([]any)
	if len(tasks) != 1 {
		t.Fatalf("expected one task, got %v", body)
	}
	if _, ok := body["revision"].(float64); !ok {
		t.Fatalf("revision missing %v", body)
	}

	// 更新限速与限额
	status, body = send(handler, http.MethodPatch, "/api/sync/tasks/"+taskID,
		`{"revision": 1, "bw_limit": "1M", "max_transfer": "1GiB"}`)
	if status != http.StatusOK {
		t.Fatalf("patch: %d %v", status, body)
	}
	task = body["task"].(map[string]any)
	if task["bw_limit"] != "1M" || task["max_transfer"] != "1GiB" {
		t.Fatalf("patch not applied %v", task)
	}

	// 端点对与端点路径校验
	if status, _ = createTask(t, handler, local, 2, func(b map[string]any) {
		b["name"] = "bad-size"
		b["bw_limit"] = "bogus"
	}); status != http.StatusBadRequest {
		t.Fatalf("bogus bw_limit should 400: %d", status)
	}
	if status, _ = createTask(t, handler, local, 2, func(b map[string]any) {
		b["name"] = "bad-path"
		b["source"] = map[string]any{"kind": "local", "path": "relative/path"}
	}); status != http.StatusBadRequest {
		t.Fatalf("relative path should 400: %d", status)
	}

	// 删除：revision 冲突返回 409
	if status, _ = send(handler, http.MethodDelete, "/api/sync/tasks/"+taskID+"?revision=99", ""); status != http.StatusConflict {
		t.Fatalf("stale revision should 409: %d", status)
	}
	if status, _ = send(handler, http.MethodDelete, "/api/sync/tasks/"+taskID+"?revision=2", ""); status != http.StatusOK {
		t.Fatalf("delete: %d", status)
	}
	status, body = send(handler, http.MethodGet, "/api/sync/tasks", "")
	if len(body["tasks"].([]any)) != 0 {
		t.Fatalf("expected empty tasks, got %v", body)
	}
}

func TestSyncTaskRunGuards(t *testing.T) {
	state, local := testState(t)
	handler := newTestHandler(state)

	_, body := createTask(t, handler, local, 0, nil)
	taskID := body["task"].(map[string]any)["id"].(string)

	// 双向同步首次运行必须 resync
	_, createBody := createTask(t, handler, local, 1, func(b map[string]any) {
		b["name"] = "mirror"
		b["operation"] = "bisync"
		b["bw_limit"] = nil
	})
	bisyncID := createBody["task"].(map[string]any)["id"].(string)

	status, body := send(handler, http.MethodPost, "/api/sync/tasks/"+bisyncID+"/run", "{}")
	if status != http.StatusConflict {
		t.Fatalf("first bisync run should 409, got %d %v", status, body)
	}
	details, _ := body["error"].(map[string]any)
	if details == nil || details["code"] != "conflict" {
		t.Fatalf("unexpected error %v", body)
	}

	// resync 请求进入启动流程，因 rclone 未运行返回 503
	status, _ = send(handler, http.MethodPost, "/api/sync/tasks/"+bisyncID+"/run", `{"resync": true}`)
	if status != http.StatusServiceUnavailable {
		t.Fatalf("resync run without rclone should 503, got %d", status)
	}

	// 单向任务同样因 rclone 未运行返回 503
	status, _ = send(handler, http.MethodPost, "/api/sync/tasks/"+taskID+"/run", "")
	if status != http.StatusServiceUnavailable {
		t.Fatalf("run without rclone should 503, got %d", status)
	}

	// 禁用的任务不能运行
	if _, body = send(handler, http.MethodPatch, "/api/sync/tasks/"+taskID, `{"revision": 2, "enabled": false}`); len(body) == 0 {
		t.Fatal("patch disabled failed")
	}
	status, _ = send(handler, http.MethodPost, "/api/sync/tasks/"+taskID+"/run", "")
	if status != http.StatusConflict {
		t.Fatalf("disabled task should 409, got %d", status)
	}
}

func TestLegacyEdgeRunRouteStillWorks(t *testing.T) {
	state, local := testState(t)
	handler := newTestHandler(state)
	_, body := createTask(t, handler, local, 0, nil)
	taskID := body["task"].(map[string]any)["id"].(string)
	status, _ := send(handler, http.MethodPost, "/api/sync/"+taskID+"/run", "")
	if status != http.StatusServiceUnavailable {
		t.Fatalf("legacy run route should stay available, got %d", status)
	}
}
