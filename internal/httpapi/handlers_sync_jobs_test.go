package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"

	"github.com/gsxhnd/ourboros/internal/app"
	"github.com/gsxhnd/ourboros/internal/rclone"
)

// fakeRC is an attach-mode rclone: it answers core/version so the supervisor
// accepts it, and lets a test decide what every other RC command returns.
type fakeRC struct {
	mu      sync.Mutex
	replies map[string]map[string]any
	calls   []string
	server  *httptest.Server
}

func newFakeRC(t *testing.T) *fakeRC {
	t.Helper()
	f := &fakeRC{replies: map[string]map[string]any{}}
	f.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		command := r.URL.Path[1:]
		f.mu.Lock()
		f.calls = append(f.calls, command)
		reply, ok := f.replies[command]
		f.mu.Unlock()
		if command == "core/version" {
			reply, ok = map[string]any{"version": "v1.70.0"}, true
		}
		if !ok {
			reply = map[string]any{}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(reply)
	}))
	t.Cleanup(f.server.Close)
	return f
}

func (f *fakeRC) reply(command string, body map[string]any) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.replies[command] = body
}

func (f *fakeRC) called(command string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, c := range f.calls {
		if c == command {
			return true
		}
	}
	return false
}

// attachedState is a state wired to the fake RC, with one sync task whose
// source is the returned local directory.
func attachedState(t *testing.T, f *fakeRC) (*app.State, string) {
	t.Helper()
	state, local := testState(t)
	state.Rclone.UpdateSettings(func(s *rclone.Settings) { s.RCURL = f.server.URL })
	if _, err := state.Rclone.Start(context.Background()); err != nil {
		t.Fatalf("attach: %v", err)
	}
	return state, local
}

func taskIDFrom(t *testing.T, body map[string]any) string {
	t.Helper()
	task, _ := body["task"].(map[string]any)
	id, _ := task["id"].(string)
	if id == "" {
		t.Fatalf("no task id in %v", body)
	}
	return id
}

// A job that has been started and is still running (rclone says it is not
// finished) is what keeps a task busy.
func startRunningJob(t *testing.T, handler http.Handler, f *fakeRC, local string) (taskID, jobID string) {
	t.Helper()
	f.reply("config/listremotes", map[string]any{"remotes": []any{"archive"}})
	f.reply("sync/sync", map[string]any{"jobid": float64(11)})
	f.reply("job/status", map[string]any{"finished": false})
	status, body := createTask(t, handler, local, 0, nil)
	if status != http.StatusCreated {
		t.Fatalf("create: %d %v", status, body)
	}
	taskID = taskIDFrom(t, body)
	status, body = send(handler, http.MethodPost, "/api/sync/tasks/"+taskID+"/run", "")
	if status != http.StatusOK {
		t.Fatalf("run: %d %v", status, body)
	}
	jobID, _ = body["id"].(string)
	if jobID == "" {
		t.Fatalf("no job id in %v", body)
	}
	return taskID, jobID
}

func TestRunningTaskCannotBeDeletedOrRunTwice(t *testing.T) {
	f := newFakeRC(t)
	state, local := attachedState(t, f)
	handler := newTestHandler(state)
	taskID, _ := startRunningJob(t, handler, f, local)

	status, body := send(handler, http.MethodDelete, "/api/sync/tasks/"+taskID+"?revision=1", "")
	if status != http.StatusConflict || errorCode(body) != "conflict" {
		t.Fatalf("delete while running: status %d body %v", status, body)
	}
	tasks, _ := state.Workspace.SyncTasks()
	if len(tasks) != 1 {
		t.Fatal("the task was deleted while its job was running")
	}
	status, body = send(handler, http.MethodPost, "/api/sync/tasks/"+taskID+"/run", "")
	if status != http.StatusConflict {
		t.Fatalf("second run: status %d body %v", status, body)
	}
}

func TestStoppingAJobEndsItAndFreesTheTask(t *testing.T) {
	f := newFakeRC(t)
	state, local := attachedState(t, f)
	handler := newTestHandler(state)
	taskID, jobID := startRunningJob(t, handler, f, local)

	// rclone confirms the stop on its next status report.
	f.reply("job/stop", map[string]any{})
	f.reply("job/status", map[string]any{"finished": true, "success": false})
	status, body := send(handler, http.MethodPost, "/api/sync/jobs/"+jobID+"/stop", "")
	if status != http.StatusOK {
		t.Fatalf("stop: status %d body %v", status, body)
	}
	if body["status"] != "cancelled" {
		t.Fatalf("job status = %v, want cancelled", body["status"])
	}
	if !f.called("job/stop") {
		t.Fatal("rclone was never told to stop the job")
	}
	if state.Jobs.IsRunning(taskID) {
		t.Fatal("the task is still marked running after its job was stopped")
	}
	// Finishing a job records its outcome on the task, which bumps the
	// workspace revision, so the delete has to quote the current one.
	tasks, revision := state.Workspace.SyncTasks()
	if len(tasks) != 1 || tasks[0].LastResult == nil || tasks[0].LastResult.JobID != jobID {
		t.Fatalf("the stopped job's result was not recorded on the task: %+v", tasks)
	}
	target := "/api/sync/tasks/" + taskID + "?revision=" + strconv.FormatUint(revision, 10)
	if status, body := send(handler, http.MethodDelete, target, ""); status != http.StatusOK {
		t.Fatalf("delete after stop: status %d body %v", status, body)
	}
}

func TestStoppingAnUnknownJobIsNotFound(t *testing.T) {
	state, _ := testState(t)
	status, body := send(newTestHandler(state), http.MethodPost, "/api/sync/jobs/nope/stop", "")
	if status != http.StatusNotFound || errorCode(body) != "not_found" {
		t.Fatalf("status %d body %v", status, body)
	}
}

func TestRunningTaskBlocksDeletingItsStorageNode(t *testing.T) {
	f := newFakeRC(t)
	state, local := attachedState(t, f)
	handler := newTestHandler(state)
	taskID, _ := startRunningJob(t, handler, f, local)

	tasks, _ := state.Workspace.SyncTasks()
	if tasks[0].ID != taskID {
		t.Fatal("unexpected task")
	}
	doc := state.Workspace.Get()
	var sourceNode string
	for _, edge := range doc.Edges {
		if edge.ID == taskID {
			sourceNode = edge.Source
		}
	}
	status, body := send(handler, http.MethodDelete, "/api/workspace/nodes/"+sourceNode+"?revision=1", "")
	if status != http.StatusConflict {
		t.Fatalf("status %d body %v", status, body)
	}
	if state.Workspace.Get().Node(sourceNode) == nil {
		t.Fatal("the node was deleted while a job used it")
	}
}
