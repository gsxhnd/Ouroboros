package httpapi

import (
	"net/http"

	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

// syncRunBody 是手动运行同步任务的可选参数。
type syncRunBody struct {
	// Resync 仅对双向同步（bisync）有效：执行重新初始化运行。
	Resync bool `json:"resync,omitempty"`
}

// syncRun 运行一条同步规则。用例校验与编排位于 service.SyncTasks。
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
	snapshot, err := a.svc.SyncTasks.Run(r.Context(), taskID, body.Resync)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}

func (a *api) syncTasksList(w http.ResponseWriter, _ *http.Request) {
	tasks, revision := a.svc.SyncTasks.List()
	writeJSON(w, http.StatusOK, map[string]any{"tasks": tasks, "revision": revision})
}

func (a *api) syncTasksCreate(w http.ResponseWriter, r *http.Request) {
	var body workspace.CreateSyncTask
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	task, doc, err := a.svc.SyncTasks.Create(r.Context(), body)
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
	task, doc, err := a.svc.SyncTasks.Patch(r.Context(), r.PathValue("id"), body)
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
	doc, err := a.svc.SyncTasks.Delete(r.PathValue("id"), revision)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, doc)
}

func (a *api) syncJobs(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"jobs": a.svc.SyncTasks.ListJobs()})
}

// syncTaskRuns 返回一个同步任务的执行记录（最新在前，分页）。
func (a *api) syncTaskRuns(w http.ResponseWriter, r *http.Request) {
	limit, offset, err := limitOffset(r)
	if err != nil {
		writeError(w, err)
		return
	}
	runs, total, err := a.svc.SyncTasks.ListRuns(r.PathValue("id"), limit, offset)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"runs": runs, "total": total})
}

// syncRunsLatest 返回每个任务最近一次执行的记录，任务页概览使用。
func (a *api) syncRunsLatest(w http.ResponseWriter, _ *http.Request) {
	runs, err := a.svc.SyncTasks.LatestRuns()
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"runs": runs})
}

func (a *api) syncEvents(w http.ResponseWriter, r *http.Request) {
	streamEvents(w, r, a.svc.Events(), func(ev events.Event) bool { return ev.Name == events.NameJob })
}

func (a *api) syncStop(w http.ResponseWriter, r *http.Request) {
	snapshot, err := a.svc.SyncTasks.StopJob(r.PathValue("job_id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}
