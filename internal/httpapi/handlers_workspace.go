package httpapi

import (
	"net/http"

	"github.com/gsxhnd/ourboros/internal/workspace"
)

func (a *api) workspaceGet(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, a.svc.Workspace.Get())
}

func (a *api) workspaceCreateNode(w http.ResponseWriter, r *http.Request) {
	var body workspace.CreateNode
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	doc, err := a.svc.Workspace.CreateNode(r.Context(), body)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, doc)
}

func (a *api) workspaceDeleteNode(w http.ResponseWriter, r *http.Request) {
	revision, err := revisionQuery(r)
	if err != nil {
		writeError(w, err)
		return
	}
	updated, err := a.svc.Workspace.DeleteNode(r.Context(), r.PathValue("id"), revision)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}
