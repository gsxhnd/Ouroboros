package httpapi

import (
	"net/http"

	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

func (a *api) mountsList(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"mounts": a.svc.Mounts.List()})
}

func (a *api) mountTasksList(w http.ResponseWriter, _ *http.Request) {
	tasks, revision := a.svc.Mounts.ListTasks()
	writeJSON(w, http.StatusOK, map[string]any{"tasks": tasks, "revision": revision})
}

func (a *api) mountTasksCreate(w http.ResponseWriter, r *http.Request) {
	var body workspace.CreateMount
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	mount, doc, err := a.svc.Mounts.Create(r.Context(), body)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"task": mount, "revision": doc.Revision})
}

func (a *api) mountTasksDelete(w http.ResponseWriter, r *http.Request) {
	revision, err := revisionQuery(r)
	if err != nil {
		writeError(w, err)
		return
	}
	doc, err := a.svc.Mounts.Delete(r.PathValue("id"), revision)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, doc)
}

func (a *api) mountEvents(w http.ResponseWriter, r *http.Request) {
	streamEvents(w, r, a.svc.Events(), func(ev events.Event) bool { return ev.Name == events.NameMount })
}

func (a *api) mountStart(w http.ResponseWriter, r *http.Request) {
	snapshot, err := a.svc.Mounts.Start(r.PathValue("edge_id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}

func (a *api) mountStop(w http.ResponseWriter, r *http.Request) {
	snapshot, err := a.svc.Mounts.Stop(r.PathValue("edge_id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}
