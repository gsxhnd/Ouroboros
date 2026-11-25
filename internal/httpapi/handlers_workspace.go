package httpapi

import (
	"net/http"

	"github.com/gsxhnd/ourboros/internal/workspace"
)

func (a *api) workspaceGet(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, a.state.Workspace.Get())
}

func (a *api) workspaceCreateNode(w http.ResponseWriter, r *http.Request) {
	var body workspace.CreateNode
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	remotes, known, err := a.remotesIfReady(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	doc, err := a.state.Workspace.CreateNode(body, remotes, known)
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
	remotes, known, err := a.remotesIfReady(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	updated, err := a.state.Workspace.DeleteNode(r.PathValue("id"), revision, remotes, known)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}
