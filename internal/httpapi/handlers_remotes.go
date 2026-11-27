package httpapi

import (
	"net/http"

	"github.com/gsxhnd/ourboros/internal/service"
)

func (a *api) remotesList(w http.ResponseWriter, r *http.Request) {
	remotes, err := a.svc.Remotes.List(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"remotes": remotes})
}

func (a *api) remotesProviders(w http.ResponseWriter, r *http.Request) {
	providers, err := a.svc.Remotes.Providers(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"providers": providers})
}

func (a *api) remotesGet(w http.ResponseWriter, r *http.Request) {
	remote, err := a.svc.Remotes.Get(r.Context(), r.PathValue("name"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, remote)
}

func (a *api) remotesDelete(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if err := a.svc.Remotes.Delete(r.Context(), name); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": name})
}

func (a *api) remotesCreate(w http.ResponseWriter, r *http.Request) {
	var body service.RemoteBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	name, err := a.svc.Remotes.Create(r.Context(), body)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"name": name})
}

func (a *api) remotesUpdate(w http.ResponseWriter, r *http.Request) {
	var body service.RemoteBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	name := r.PathValue("name")
	if err := a.svc.Remotes.Update(r.Context(), name, body); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"name": name})
}
