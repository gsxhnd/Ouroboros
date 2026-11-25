package httpapi

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/settings"
)

func (a *api) rcloneStatus(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, a.state.Rclone.Status())
}

func (a *api) rcloneStart(w http.ResponseWriter, r *http.Request) {
	status, err := a.state.Rclone.EnsureRunning(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func (a *api) rcloneStop(w http.ResponseWriter, r *http.Request) {
	status, err := a.state.Rclone.Stop(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, status)
}

func (a *api) rcloneScan(w http.ResponseWriter, r *http.Request) {
	doc := a.state.Settings.Get()
	custom := ""
	if doc.RcloneBin != nil {
		path := *doc.RcloneBin
		if filepath.IsAbs(path) || fileExists(path) {
			custom = path
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"candidates": rclone.Scan(r.Context(), custom, a.state.VersionsDir()),
	})
}

func (a *api) rcloneSelect(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Source  rclone.SourceKind `json:"source"`
		Path    *string           `json:"path"`
		Version *string           `json:"version"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	var path string
	switch body.Source {
	case rclone.SourceManaged:
		if body.Version == nil || *body.Version == "" {
			badRequest(w, "managed source requires version")
			return
		}
		version, err := rclone.SafeVersion(*body.Version)
		if err != nil {
			writeError(w, err)
			return
		}
		path = rclone.ManagedBinaryPath(a.state.VersionsDir(), version)
	default:
		if body.Path == nil || *body.Path == "" {
			badRequest(w, "source requires an executable path")
			return
		}
		path = *body.Path
	}
	if _, err := os.Stat(path); err != nil {
		writeError(w, core.BinaryNotFound(path))
		return
	}
	if err := a.state.UseRcloneBinary(settings.SourceKind(body.Source), &path); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, a.state.Rclone.Status())
}

func (a *api) rcloneReleases(w http.ResponseWriter, r *http.Request) {
	current, err := rclone.CurrentRelease(r.Context(), a.state.Rclone.Client())
	if err != nil {
		writeError(w, err)
		return
	}
	release, err := rclone.ReleaseForPlatform(current.Version)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"current":  current.Version,
		"releases": []rclone.Release{release},
	})
}

func (a *api) rcloneDownloadStart(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Version string `json:"version"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	snapshot, err := a.state.Downloads.Start(a.state.Context(), body.Version, a.state.VersionsDir(), func(snapshot rclone.DownloadSnapshot) {
		a.state.Events.Publish(events.NameDownload, snapshot)
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}

func (a *api) rcloneDownloadEvents(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	streamEvents(w, r, a.state.Events, func(ev events.Event) bool {
		if ev.Name != events.NameDownload {
			return false
		}
		snapshot, ok := ev.Payload.(rclone.DownloadSnapshot)
		return ok && snapshot.ID == id
	})
}

func (a *api) rcloneDownloadCancel(w http.ResponseWriter, r *http.Request) {
	snapshot, err := a.state.Downloads.Cancel(r.PathValue("id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}

func (a *api) rcloneActivate(w http.ResponseWriter, r *http.Request) {
	version, err := rclone.SafeVersion(r.PathValue("version"))
	if err != nil {
		writeError(w, err)
		return
	}
	path := rclone.ManagedBinaryPath(a.state.VersionsDir(), version)
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		writeError(w, core.NotFound("managed rclone "+version))
		return
	}
	if err := a.state.UseRcloneBinary(settings.SourceManaged, &path); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, a.state.Rclone.Status())
}

func (a *api) rcloneDeleteVersion(w http.ResponseWriter, r *http.Request) {
	version, err := rclone.SafeVersion(r.PathValue("version"))
	if err != nil {
		writeError(w, err)
		return
	}
	dir := filepath.Join(a.state.VersionsDir(), version)
	if _, err := os.Stat(dir); err != nil {
		writeError(w, core.NotFound("managed rclone "+version))
		return
	}
	current := a.state.Rclone.SelectedBin()
	managed := rclone.ManagedBinaryPath(a.state.VersionsDir(), version)
	if err := os.RemoveAll(dir); err != nil {
		writeError(w, core.IO(err))
		return
	}
	if filepath.Clean(current) == filepath.Clean(managed) {
		if err := a.state.UseRcloneBinary(settings.SourceSystem, nil); err != nil {
			writeError(w, err)
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
