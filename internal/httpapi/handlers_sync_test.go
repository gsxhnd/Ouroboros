package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/gsxhnd/ourboros/internal/app"
	"github.com/gsxhnd/ourboros/internal/history"
	"github.com/gsxhnd/ourboros/internal/jobs"
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
	errorBody, _ := body["error"].(map[string]any)
	if errorBody == nil || errorBody["code"] != "conflict" {
		t.Fatalf("unexpected error %v", body)
	}
	conflictDetails, _ := errorBody["details"].(map[string]any)
	if conflictDetails["kind"] != "bisync_resync_required" {
		t.Fatalf("unexpected conflict details %v", conflictDetails)
	}
	if _, exists := conflictDetails["message"]; exists {
		t.Fatalf("bisync details gained a duplicate message: %v", conflictDetails)
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
	status, body = send(handler, http.MethodPost, "/api/sync/tasks/"+taskID+"/run", "")
	if status != http.StatusConflict {
		t.Fatalf("disabled task should 409, got %d", status)
	}
	errorBody, _ = body["error"].(map[string]any)
	conflictDetails, _ = errorBody["details"].(map[string]any)
	if len(conflictDetails) != 0 {
		t.Fatalf("disabled task details changed: %v", conflictDetails)
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

// 执行历史接口：bbolt 写入 → 任务记录分页读取 → 每任务最新一条。
func TestSyncTaskRunsEndpoint(t *testing.T) {
	dir := t.TempDir()
	local := filepath.Join(dir, "local")
	if err := os.MkdirAll(local, 0o755); err != nil {
		t.Fatal(err)
	}
	state, err := app.New(context.Background(), app.Config{
		DataDir:     dir,
		HistoryPath: filepath.Join(dir, "history.db"),
		RcloneBin:   filepath.Join(dir, "missing-rclone"),
	})
	if err != nil {
		t.Fatal(err)
	}
	handler := newTestHandler(state)

	_, body := createTask(t, handler, local, 0, nil)
	taskID := body["task"].(map[string]any)["id"].(string)

	// 还没有执行记录
	status, body := send(handler, http.MethodGet, "/api/sync/tasks/"+taskID+"/runs", "")
	if status != http.StatusOK {
		t.Fatalf("empty runs: %d %v", status, body)
	}
	if runs, _ := body["runs"].([]any); len(runs) != 0 || body["total"].(float64) != 0 {
		t.Fatalf("expected empty runs, got %v", body)
	}

	// 写入两次执行：旧的失败、新的成功
	base := time.Now().UTC().Add(-time.Hour)
	older := history.Run{
		ID: "run-old", TaskID: taskID, Operation: "sync", Trigger: "scheduled",
		Status: history.StatusRunning, StartedAt: base,
		Source: history.Locator{Kind: "local", FS: local},
	}
	if err := state.History.Start(older); err != nil {
		t.Fatal(err)
	}
	if err := state.History.Finish(history.FinishInput{
		TaskID: taskID, RunID: "run-old", StartedAt: base,
		Status: string(jobs.StatusFailed), Error: "boom",
		FinishedAt: base.Add(time.Minute),
	}); err != nil {
		t.Fatal(err)
	}
	newer := history.Run{
		ID: "run-new", TaskID: taskID, Operation: "sync", Trigger: "manual",
		Status: history.StatusRunning, StartedAt: base.Add(time.Hour),
	}
	if err := state.History.Start(newer); err != nil {
		t.Fatal(err)
	}
	if err := state.History.Finish(history.FinishInput{
		TaskID: taskID, RunID: "run-new", StartedAt: base.Add(time.Hour),
		Status: string(jobs.StatusSucceeded), FinishedAt: base.Add(2 * time.Hour),
		Stats: &history.RunStats{Bytes: 2048, Transfers: 4},
	}); err != nil {
		t.Fatal(err)
	}

	status, body = send(handler, http.MethodGet, "/api/sync/tasks/"+taskID+"/runs?limit=1&offset=0", "")
	if status != http.StatusOK {
		t.Fatalf("runs: %d %v", status, body)
	}
	if body["total"].(float64) != 2 {
		t.Fatalf("total = %v", body["total"])
	}
	runs := body["runs"].([]any)
	if len(runs) != 1 {
		t.Fatalf("limit=1 should return one run: %v", body)
	}
	first := runs[0].(map[string]any)
	if first["id"] != "run-new" || first["status"] != "succeeded" || first["trigger"] != "manual" {
		t.Fatalf("newest-first broken: %v", first)
	}
	if first["stats"].(map[string]any)["bytes"].(float64) != 2048 {
		t.Fatalf("stats missing: %v", first)
	}

	// 每任务最新一条
	status, body = send(handler, http.MethodGet, "/api/sync/runs/latest", "")
	if status != http.StatusOK {
		t.Fatalf("latest: %d %v", status, body)
	}
	latest := body["runs"].([]any)
	if len(latest) != 1 {
		t.Fatalf("expected one latest run, got %v", body)
	}
	if latest[0].(map[string]any)["id"] != "run-new" {
		t.Fatalf("latest should be the newest run: %v", latest)
	}

	// 分页参数非法返回 400；未知任务返回 404
	if status, _ = send(handler, http.MethodGet, "/api/sync/tasks/"+taskID+"/runs?limit=0", ""); status != http.StatusBadRequest {
		t.Fatalf("bad limit should 400, got %d", status)
	}
	if status, _ = send(handler, http.MethodGet, "/api/sync/tasks/does-not-exist/runs", ""); status != http.StatusNotFound {
		t.Fatalf("unknown task should 404, got %d", status)
	}

	// 删除任务会同时清掉它的历史
	_, listBody := send(handler, http.MethodGet, "/api/sync/tasks", "")
	rev := int(listBody["revision"].(float64))
	if status, _ = send(handler, http.MethodDelete, "/api/sync/tasks/"+taskID+"?revision="+strconv.Itoa(rev), ""); status != http.StatusOK {
		t.Fatalf("delete: %d", status)
	}
	remaining, total, err := state.History.List(taskID, 0, 0)
	if err != nil || total != 0 || len(remaining) != 0 {
		t.Fatalf("history should be gone after task delete: %d %d %v", total, len(remaining), err)
	}
}
