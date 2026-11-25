package httpapi

import (
	"net/http"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/jobs"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

// syncRunBody 是手动运行同步任务的可选参数。
type syncRunBody struct {
	// Resync 仅对双向同步（bisync）有效：执行重新初始化运行。
	Resync bool `json:"resync,omitempty"`
}

// syncRun 运行一条同步规则。手动运行使用任务上保存的参数（限速、限额），
// 与计划执行保持一致。双向同步首次运行需要 resync=true 建立基线。
func (a *api) syncRun(w http.ResponseWriter, r *http.Request) {
	taskID := r.PathValue("id")
	if taskID == "" {
		taskID = r.PathValue("edge_id")
	}
	var body syncRunBody
	if err := decodeJSONOptional(r, &body); err != nil {
		writeError(w, err)
		return
	}
	doc := a.state.Workspace.Get()
	edge := doc.Edge(taskID)
	if edge == nil {
		writeError(w, core.NotFound("sync task "+taskID))
		return
	}
	if edge.Kind != workspace.EdgeSync {
		badRequest(w, "only sync tasks can be run")
		return
	}
	if edge.Sync == nil {
		badRequest(w, "sync task is missing configuration")
		return
	}
	if !edge.Sync.Enabled {
		writeAPIError(w, http.StatusConflict, "conflict", "sync task is disabled", map[string]any{})
		return
	}
	if edge.Sync.Operation.TwoWay() && edge.Sync.LastResult == nil && !body.Resync {
		writeAPIError(w, http.StatusConflict, "conflict", "two-way sync requires an initial resync run", map[string]any{"kind": "bisync_resync_required"})
		return
	}
	source, err := doc.NodeLocator(edge.Source, a.state.HomeDir)
	if err != nil {
		writeError(w, err)
		return
	}
	target, err := doc.NodeLocator(edge.Target, a.state.HomeDir)
	if err != nil {
		writeError(w, err)
		return
	}
	snapshot, err := a.state.Jobs.Start(taskID, edge.Sync.Operation, source, target, jobs.Options{
		BWLimit:     edge.Sync.BWLimit,
		MaxTransfer: edge.Sync.MaxTransfer,
		Resync:      body.Resync,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}

func (a *api) syncTasksList(w http.ResponseWriter, _ *http.Request) {
	tasks, revision := a.state.Workspace.SyncTasks()
	writeJSON(w, http.StatusOK, map[string]any{"tasks": tasks, "revision": revision})
}

func (a *api) syncTasksCreate(w http.ResponseWriter, r *http.Request) {
	var body workspace.CreateSyncTask
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	remotes, known, err := a.remotesIfReady(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	task, doc, err := a.state.Workspace.CreateSyncTask(body, remotes, known)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"task": task, "revision": doc.Revision})
}

func (a *api) syncTasksPatch(w http.ResponseWriter, r *http.Request) {
	var body workspace.PatchSyncTask
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	remotes, known, err := a.remotesIfReady(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	task, doc, err := a.state.Workspace.PatchSyncTask(r.PathValue("id"), body, remotes, known)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"task": task, "revision": doc.Revision})
}

func (a *api) syncTasksDelete(w http.ResponseWriter, r *http.Request) {
	revision, err := revisionQuery(r)
	if err != nil {
		writeError(w, err)
		return
	}
	id := r.PathValue("id")
	if err := a.ensureIdle([]string{id}); err != nil {
		writeError(w, err)
		return
	}
	doc, err := a.state.Workspace.DeleteSyncTask(id, revision)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, doc)
}

func (a *api) syncJobs(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"jobs": a.state.Jobs.List()})
}

func (a *api) syncEvents(w http.ResponseWriter, r *http.Request) {
	streamEvents(w, r, a.state.Events, func(ev events.Event) bool { return ev.Name == events.NameJob })
}

func (a *api) syncStop(w http.ResponseWriter, r *http.Request) {
	snapshot, err := a.state.Jobs.Stop(r.PathValue("job_id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}
