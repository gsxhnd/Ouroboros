package httpapi

import (
	"net/http"
	"testing"
)

// TestStorageDeleteProtection 验证仍被同步任务引用的存储端点不能被删除：
// 本地节点删除返回 node_in_use，remote 删除返回 remote_in_use。
func TestStorageDeleteProtection(t *testing.T) {
	state, local := testState(t)
	handler := Handler(state, "")

	// 建一个本地节点，再建一个使用它的同步任务
	status, body := send(handler, http.MethodPost, "/api/workspace/nodes", `{
		"revision": 0,
		"kind": "local",
		"label": "Backups",
		"position": {"x": 0, "y": 0},
		"local_path": "`+local+`"
	}`)
	if status != http.StatusCreated {
		t.Fatalf("create node: %d %v", status, body)
	}
	docNodes := body["nodes"].([]any)
	nodeID := docNodes[len(docNodes)-1].(map[string]any)["id"].(string)
	if nodeID == "" {
		t.Fatalf("node id missing: %v", body)
	}
	status, body = send(handler, http.MethodPost, "/api/sync/tasks", `{
		"revision": 1,
		"name": "backup",
		"operation": "sync",
		"source": {"kind": "local", "path": "`+local+`"},
		"target": {"kind": "remote", "remote": "archive", "path": "docs"}
	}`)
	if status != http.StatusCreated {
		t.Fatalf("create task: %d %v", status, body)
	}
	// 任务复用了同一个本地节点，节点删除应被拒绝
	status, body = send(handler, http.MethodDelete, "/api/workspace/nodes/"+nodeID+"?revision=2", "")
	if status != http.StatusConflict {
		t.Fatalf("referenced node delete should 409, got %d %v", status, body)
	}
	if body["error"].(map[string]any)["details"].(map[string]any)["kind"] != "node_in_use" {
		t.Fatalf("unexpected error %v", body)
	}

	// 建一个引用 remote 的节点，remote 删除应被拒绝（在触达 rclone 之前）
	status, body = send(handler, http.MethodPost, "/api/workspace/nodes", `{
		"revision": 2,
		"kind": "remote",
		"label": "Archive",
		"position": {"x": 0, "y": 0},
		"remote": {"name": "archive", "path": ""}
	}`)
	if status != http.StatusCreated {
		t.Fatalf("create remote node: %d %v", status, body)
	}
	status, body = send(handler, http.MethodDelete, "/api/remotes/archive", "")
	if status != http.StatusConflict {
		t.Fatalf("referenced remote delete should 409, got %d %v", status, body)
	}
	if body["error"].(map[string]any)["details"].(map[string]any)["kind"] != "remote_in_use" {
		t.Fatalf("unexpected error %v", body)
	}

	// 未被引用的 remote 删除会进入 rclone 调用，rclone 未运行时应返回 503
	status, _ = send(handler, http.MethodDelete, "/api/remotes/unused-remote", "")
	if status != http.StatusServiceUnavailable {
		t.Fatalf("unused remote delete should 503 without rclone, got %d", status)
	}
}
