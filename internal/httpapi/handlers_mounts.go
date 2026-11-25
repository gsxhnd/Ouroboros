package httpapi

import (
	"net/http"

	"github.com/gsxhnd/ourboros/internal/events"
)

func (a *api) mountsList(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"mounts": a.state.Mounts.List()})
}

func (a *api) mountEvents(w http.ResponseWriter, r *http.Request) {
	streamEvents(w, r, a.state.Events, func(ev events.Event) bool { return ev.Name == events.NameMount })
}

func (a *api) mountStart(w http.ResponseWriter, r *http.Request) {
	snapshot, err := a.state.Mounts.Start(r.PathValue("edge_id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}

func (a *api) mountStop(w http.ResponseWriter, r *http.Request) {
	snapshot, err := a.state.Mounts.Stop(r.PathValue("edge_id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}
