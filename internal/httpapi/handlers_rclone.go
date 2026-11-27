package httpapi

import (
	"net/http"

	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/service"
)

func (a *api) rcloneStatus(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, a.svc.Rclone.Status())
}

func (a *api) rcloneStart(w http.ResponseWriter, r *http.Request) {
	status, err := a.svc.Rclone.EnsureRunning(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func (a *api) rcloneStop(w http.ResponseWriter, r *http.Request) {
	status, err := a.svc.Rclone.Stop(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func (a *api) rcloneScan(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"candidates": a.svc.Rclone.Scan(r.Context()),
	})
}

func (a *api) rcloneSelect(w http.ResponseWriter, r *http.Request) {
	var body service.RcloneSelection
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	status, err := a.svc.Rclone.Select(body)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func (a *api) rcloneReleases(w http.ResponseWriter, r *http.Request) {
	releases, err := a.svc.Rclone.Releases(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, releases)
}

func (a *api) rcloneDownloadStart(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Version string `json:"version"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	snapshot, err := a.svc.Rclone.DownloadStart(body.Version)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}

func (a *api) rcloneDownloadEvents(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	streamEvents(w, r, a.svc.Events(), func(ev events.Event) bool {
		if ev.Name != events.NameDownload {
			return false
		}
		snapshot, ok := ev.Payload.(rclone.DownloadSnapshot)
		return ok && snapshot.ID == id
	})
}

func (a *api) rcloneDownloadCancel(w http.ResponseWriter, r *http.Request) {
	snapshot, err := a.svc.Rclone.DownloadCancel(r.PathValue("id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}

func (a *api) rcloneActivate(w http.ResponseWriter, r *http.Request) {
	status, err := a.svc.Rclone.Activate(r.PathValue("version"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func (a *api) rcloneDeleteVersion(w http.ResponseWriter, r *http.Request) {
	if err := a.svc.Rclone.DeleteVersion(r.PathValue("version")); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
