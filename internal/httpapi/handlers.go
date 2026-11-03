package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gsxhnd/ourboros/internal/app"
	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/paths"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/settings"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

func Handler(state *app.State, webDir string) http.Handler {
	api := &api{state: state}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", api.health)
	mux.HandleFunc("GET /api/system/info", api.systemInfo)
	mux.HandleFunc("GET /api/rclone/status", api.rcloneStatus)
	mux.HandleFunc("POST /api/rclone/start", api.rcloneStart)
	mux.HandleFunc("POST /api/rclone/stop", api.rcloneStop)
	mux.HandleFunc("POST /api/rclone/scan", api.rcloneScan)
	mux.HandleFunc("POST /api/rclone/select", api.rcloneSelect)
	mux.HandleFunc("GET /api/rclone/releases", api.rcloneReleases)
	mux.HandleFunc("POST /api/rclone/downloads", api.rcloneDownloadStart)
	mux.HandleFunc("GET /api/rclone/downloads/{id}/events", api.rcloneDownloadEvents)
	mux.HandleFunc("POST /api/rclone/downloads/{id}/cancel", api.rcloneDownloadCancel)
	mux.HandleFunc("POST /api/rclone/versions/{version}/activate", api.rcloneActivate)
	mux.HandleFunc("DELETE /api/rclone/versions/{version}", api.rcloneDeleteVersion)
	mux.HandleFunc("GET /api/workspace", api.workspaceGet)
	mux.HandleFunc("PUT /api/workspace", api.workspacePut)
	mux.HandleFunc("POST /api/workspace/nodes", api.workspaceCreateNode)
	mux.HandleFunc("PATCH /api/workspace/nodes/{id}", api.workspacePatchNode)
	mux.HandleFunc("DELETE /api/workspace/nodes/{id}", api.workspaceDeleteNode)
	mux.HandleFunc("POST /api/workspace/edges", api.workspaceCreateEdge)
	mux.HandleFunc("PATCH /api/workspace/edges/{id}", api.workspacePatchEdge)
	mux.HandleFunc("DELETE /api/workspace/edges/{id}", api.workspaceDeleteEdge)
	mux.HandleFunc("GET /api/remotes/providers", api.remotesProviders)
	mux.HandleFunc("GET /api/remotes", api.remotesList)
	mux.HandleFunc("POST /api/remotes", api.remotesCreate)
	mux.HandleFunc("GET /api/remotes/{name}", api.remotesGet)
	mux.HandleFunc("PATCH /api/remotes/{name}", api.remotesUpdate)
	mux.HandleFunc("GET /api/files", api.filesList)
	mux.HandleFunc("DELETE /api/files", api.filesDelete)
	mux.HandleFunc("POST /api/files/mkdir", api.filesMkdir)
	mux.HandleFunc("POST /api/files/copy", api.filesCopy)
	mux.HandleFunc("POST /api/files/move", api.filesMove)
	mux.HandleFunc("POST /api/sync/{edge_id}/run", api.syncRun)
	mux.HandleFunc("GET /api/sync/jobs", api.syncJobs)
	mux.HandleFunc("GET /api/sync/jobs/events", api.syncEvents)
	mux.HandleFunc("POST /api/sync/jobs/{job_id}/stop", api.syncStop)
	mux.HandleFunc("GET /api/mounts", api.mountsList)
	mux.HandleFunc("GET /api/mounts/events", api.mountEvents)
	mux.HandleFunc("POST /api/mounts/{edge_id}/start", api.mountStart)
	mux.HandleFunc("POST /api/mounts/{edge_id}/stop", api.mountStop)
	mux.HandleFunc("GET /api/settings", api.settingsGet)
	mux.HandleFunc("PATCH /api/settings", api.settingsPatch)
	mux.HandleFunc("POST /api/rc/{command...}", api.proxyRC)

	return withCORS(state.Origins, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api") || r.URL.Path == "/health" {
			mux.ServeHTTP(w, r)
			return
		}
		serveUI(w, r, webDir)
	}))
}

type api struct{ state *app.State }

func (a *api) health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = io.WriteString(w, "ok")
}

func (a *api) systemInfo(w http.ResponseWriter, _ *http.Request) {
	var home *string
	if a.state.HomeDir != "" {
		value := a.state.HomeDir
		home = &value
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"name":     "ourboros",
		"version":  a.state.Version,
		"home_dir": home,
		"rclone":   a.state.Rclone.Status(),
	})
}

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
	selected := path
	a.state.Rclone.UpdateSettings(func(settings *rclone.Settings) {
		settings.Bin = selected
	})
	_, _ = a.state.Settings.Patch(settings.Patch{
		RcloneSource: &body.Source,
		RcloneBin:    settings.Nullable[string]{Set: true, Value: &selected},
	})
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
		a.state.Events.Publish("download", snapshot)
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
		if ev.Name != "download" {
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
	selected := path
	a.state.Rclone.UpdateSettings(func(settings *rclone.Settings) {
		settings.Bin = selected
	})
	source := rclone.SourceManaged
	_, _ = a.state.Settings.Patch(settings.Patch{
		RcloneSource: &source,
		RcloneBin:    settings.Nullable[string]{Set: true, Value: &selected},
	})
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
		a.state.Rclone.UpdateSettings(func(settings *rclone.Settings) {
			settings.Bin = "rclone"
		})
		source := rclone.SourceSystem
		_, _ = a.state.Settings.Patch(settings.Patch{
			RcloneSource: &source,
			RcloneBin:    settings.Nullable[string]{Set: true, Value: nil},
		})
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *api) workspaceGet(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, a.state.Workspace.Get())
}

func (a *api) workspacePut(w http.ResponseWriter, r *http.Request) {
	var body workspace.PutRequest
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	remotes, known, err := a.remotesIfReady(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	doc, err := a.state.Workspace.Replace(body, remotes, known)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, doc)
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

func (a *api) workspacePatchNode(w http.ResponseWriter, r *http.Request) {
	var body workspace.PatchNode
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	remotes, known, err := a.remotesIfReady(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	doc, err := a.state.Workspace.PatchNode(r.PathValue("id"), body, remotes, known)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, doc)
}

func (a *api) workspaceDeleteNode(w http.ResponseWriter, r *http.Request) {
	revision, err := revisionQuery(r)
	if err != nil {
		writeError(w, err)
		return
	}
	doc := a.state.Workspace.Get()
	if err := a.ensureIdle(workspace.RelatedEdgeIDs(doc, r.PathValue("id"))); err != nil {
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

func (a *api) workspaceCreateEdge(w http.ResponseWriter, r *http.Request) {
	var body workspace.CreateEdge
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	remotes, known, err := a.remotesIfReady(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	doc, err := a.state.Workspace.CreateEdge(body, remotes, known)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, doc)
}

func (a *api) workspacePatchEdge(w http.ResponseWriter, r *http.Request) {
	var body workspace.PatchEdge
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	remotes, known, err := a.remotesIfReady(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	doc, err := a.state.Workspace.PatchEdge(r.PathValue("id"), body, remotes, known)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, doc)
}

func (a *api) workspaceDeleteEdge(w http.ResponseWriter, r *http.Request) {
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
	remotes, known, err := a.remotesIfReady(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	doc, err := a.state.Workspace.DeleteEdge(id, revision, remotes, known)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, doc)
}

func (a *api) remotesList(w http.ResponseWriter, r *http.Request) {
	remotes, err := a.state.Rclone.ListRemotes(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	types := map[string]string{}
	if dump, dumpErr := a.state.Rclone.CallInternal(r.Context(), "config/dump", map[string]any{}); dumpErr == nil && dump.OK() {
		types = rclone.RemoteTypes(dump.Body)
	}
	items := make([]map[string]string, 0, len(remotes))
	for _, name := range remotes {
		item := map[string]string{"name": name}
		if kind := types[name]; kind != "" {
			item["type"] = kind
		}
		items = append(items, item)
	}
	writeJSON(w, http.StatusOK, map[string]any{"remotes": items})
}

func (a *api) remotesProviders(w http.ResponseWriter, r *http.Request) {
	providers, err := a.providerList(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"providers": providers})
}

func (a *api) remotesGet(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	response, err := a.state.Rclone.CallInternal(r.Context(), "config/get", map[string]any{"name": name})
	if err != nil {
		writeError(w, err)
		return
	}
	if err := mapUpstream(response); err != nil {
		writeError(w, err)
		return
	}
	typeName, _ := response.Body["type"].(string)
	parameters := map[string]any{}
	if providers, err := a.providerList(r.Context()); err == nil {
		parameters = rclone.PublicParameters(providers, typeName, response.Body)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"name":       name,
		"type":       typeName,
		"parameters": parameters,
	})
}

func (a *api) providerList(ctx context.Context) ([]rclone.Provider, error) {
	response, err := a.state.Rclone.CallInternal(ctx, "config/providers", map[string]any{})
	if err != nil {
		return nil, err
	}
	if err := mapUpstream(response); err != nil {
		return nil, err
	}
	return rclone.ParseProviders(response.Body)
}

func (a *api) remotesCreate(w http.ResponseWriter, r *http.Request) {
	var body remoteBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if body.Name == nil || *body.Name == "" {
		badRequest(w, "remote name is required")
		return
	}
	if body.Type == nil || *body.Type == "" {
		badRequest(w, "remote type is required")
		return
	}
	if body.Parameters == nil {
		body.Parameters = map[string]any{}
	}
	response, err := a.state.Rclone.CallInternal(r.Context(), "config/create", map[string]any{
		"name":       *body.Name,
		"type":       *body.Type,
		"parameters": body.Parameters,
		"opt":        map[string]any{"nonInteractive": true, "obscure": true},
	})
	if err != nil {
		writeError(w, err)
		return
	}
	if err := mapUpstream(response); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"name": *body.Name})
}

func (a *api) remotesUpdate(w http.ResponseWriter, r *http.Request) {
	var body remoteBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if body.Parameters == nil {
		body.Parameters = map[string]any{}
	}
	response, err := a.state.Rclone.CallInternal(r.Context(), "config/update", map[string]any{
		"name":       r.PathValue("name"),
		"parameters": body.Parameters,
		"opt":        map[string]any{"nonInteractive": true, "obscure": true},
	})
	if err != nil {
		writeError(w, err)
		return
	}
	if err := mapUpstream(response); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"name": r.PathValue("name")})
}

func (a *api) filesList(w http.ResponseWriter, r *http.Request) {
	locator, err := fileQuery(r, a.state.HomeDir)
	if err != nil {
		writeError(w, err)
		return
	}
	response, err := a.state.Rclone.CallInternal(r.Context(), "operations/list", map[string]any{
		"fs":     locator.RcloneFS(),
		"remote": locator.RcloneRemote(),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	if err := mapUpstream(response); err != nil {
		writeError(w, err)
		return
	}
	items := []any{}
	if raw, ok := response.Body["list"].([]any); ok {
		items = make([]any, 0, len(raw))
		for _, item := range raw {
			object, _ := item.(map[string]any)
			items = append(items, mapListItem(object))
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"fs":     locator.FS,
		"remote": locator.Remote,
		"items":  items,
	})
}

func (a *api) filesMkdir(w http.ResponseWriter, r *http.Request) {
	var body fileBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	locator, err := locatorFromBody(body.FS, body.Remote, body.Path, a.state.HomeDir)
	if err != nil {
		writeError(w, err)
		return
	}
	response, err := a.state.Rclone.CallInternal(r.Context(), "operations/mkdir", map[string]any{
		"fs":     locator.RcloneFS(),
		"remote": locator.RcloneRemote(),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	if err := mapUpstream(response); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"fs":          locator.FS,
		"remote":      locator.Remote,
		"destructive": false,
		"impact":      "Create directory " + locator.Display(),
	})
}

func (a *api) filesCopy(w http.ResponseWriter, r *http.Request) {
	a.transfer(w, r, false)
}

func (a *api) filesMove(w http.ResponseWriter, r *http.Request) {
	a.transfer(w, r, true)
}

func (a *api) filesDelete(w http.ResponseWriter, r *http.Request) {
	locator, err := fileQuery(r, a.state.HomeDir)
	if err != nil {
		writeError(w, err)
		return
	}
	purge := r.URL.Query().Get("purge") == "true"
	command := "operations/deletefile"
	if purge {
		command = "operations/purge"
	}
	response, err := a.state.Rclone.CallInternal(r.Context(), command, map[string]any{
		"fs":     locator.RcloneFS(),
		"remote": locator.RcloneRemote(),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	if err := mapUpstream(response); err != nil {
		writeError(w, err)
		return
	}
	impact := "Delete file " + locator.Display() + "."
	if purge {
		impact = "Permanently delete " + locator.Display() + " and all of its contents."
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"fs":          locator.FS,
		"remote":      locator.Remote,
		"destructive": true,
		"source":      locator,
		"impact":      impact,
	})
}

func (a *api) syncRun(w http.ResponseWriter, r *http.Request) {
	edgeID := r.PathValue("edge_id")
	doc := a.state.Workspace.Get()
	edge := doc.Edge(edgeID)
	if edge == nil {
		writeError(w, core.NotFound("edge "+edgeID))
		return
	}
	if edge.Kind != workspace.EdgeSync {
		badRequest(w, "only sync edges can be run")
		return
	}
	if edge.Sync == nil {
		badRequest(w, "sync edge is missing configuration")
		return
	}
	if !edge.Sync.Enabled {
		writeAPIError(w, http.StatusConflict, "conflict", "sync edge is disabled", map[string]any{})
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
	snapshot, err := a.state.Jobs.Start(a.state.Rclone, a.state.Workspace, edgeID, edge.Sync.Operation, source, target)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}

func (a *api) syncJobs(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"jobs": a.state.Jobs.List()})
}

func (a *api) syncEvents(w http.ResponseWriter, r *http.Request) {
	streamEvents(w, r, a.state.Events, func(ev events.Event) bool { return ev.Name == "job" })
}

func (a *api) syncStop(w http.ResponseWriter, r *http.Request) {
	snapshot, err := a.state.Jobs.Stop(a.state.Rclone, r.PathValue("job_id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snapshot)
}

func (a *api) mountsList(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"mounts": a.state.Mounts.List(a.state.Workspace)})
}

func (a *api) mountEvents(w http.ResponseWriter, r *http.Request) {
	streamEvents(w, r, a.state.Events, func(ev events.Event) bool { return ev.Name == "mount" })
}

func (a *api) mountStart(w http.ResponseWriter, r *http.Request) {
	snapshot, err := a.state.Mounts.Start(a.state.Rclone, a.state.Workspace, r.PathValue("edge_id"))
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

func (a *api) settingsGet(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, a.state.Settings.Get())
}

func (a *api) settingsPatch(w http.ResponseWriter, r *http.Request) {
	var body settings.Patch
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	if a.state.CLIBinOverride && body.RcloneBin.Set {
		writeAPIError(w, http.StatusConflict, "conflict", "rclone binary is overridden by CLI for this process", map[string]any{})
		return
	}
	if a.state.CLIConfigOverride && body.RcloneConfig.Set {
		writeAPIError(w, http.StatusConflict, "conflict", "rclone config is overridden by CLI for this process", map[string]any{})
		return
	}
	if a.state.CLIURLOverride && body.RcloneRCURL.Set {
		writeAPIError(w, http.StatusConflict, "conflict", "rclone RC endpoint is overridden by CLI for this process", map[string]any{})
		return
	}
	doc, err := a.state.Settings.Patch(body)
	if err != nil {
		writeError(w, err)
		return
	}
	if len(body.Shortcuts) > 0 {
		a.state.Events.Publish("settings", doc)
	}
	if !a.state.CLIBinOverride && doc.RcloneBin != nil {
		bin := *doc.RcloneBin
		a.state.Rclone.UpdateSettings(func(settings *rclone.Settings) { settings.Bin = bin })
	}
	if !a.state.CLIConfigOverride {
		config := ""
		if doc.RcloneConfig != nil {
			config = *doc.RcloneConfig
		}
		a.state.Rclone.UpdateSettings(func(settings *rclone.Settings) { settings.Config = config })
	}
	if !a.state.CLIURLOverride {
		rcURL := ""
		if doc.RcloneRCURL != nil {
			rcURL = *doc.RcloneRCURL
		}
		a.state.Rclone.UpdateSettings(func(settings *rclone.Settings) { settings.RCURL = rcURL })
	}
	writeJSON(w, http.StatusOK, doc)
}

func (a *api) proxyRC(w http.ResponseWriter, r *http.Request) {
	command := r.PathValue("command")
	payload := map[string]any{}
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, core.IO(err))
		return
	}
	if len(bytes.TrimSpace(raw)) > 0 {
		dec := json.NewDecoder(bytes.NewReader(raw))
		dec.UseNumber()
		if err := dec.Decode(&payload); err != nil {
			writeError(w, core.InvalidRequest(err.Error()))
			return
		}
	}
	response, err := a.state.Rclone.CallAllowed(r.Context(), command, payload)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, response.Status, response.Body)
}

func (a *api) transfer(w http.ResponseWriter, r *http.Request, move bool) {
	var body transferBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, err)
		return
	}
	source, err := locatorFromBody(body.SrcFS, body.SrcRemote, body.SrcPath, a.state.HomeDir)
	if err != nil {
		writeError(w, err)
		return
	}
	target, err := locatorFromBody(body.DstFS, body.DstRemote, body.DstPath, a.state.HomeDir)
	if err != nil {
		writeError(w, err)
		return
	}
	directory := body.Directory != nil && *body.Directory
	var command string
	payload := map[string]any{}
	if directory {
		if move {
			command = "sync/move"
		} else {
			command = "sync/copy"
		}
		payload["srcFs"] = source.CombinedFS()
		payload["dstFs"] = target.CombinedFS()
	} else if move {
		command = "operations/movefile"
		payload["srcFs"] = source.RcloneFS()
		payload["srcRemote"] = source.RcloneRemote()
		payload["dstFs"] = target.RcloneFS()
		payload["dstRemote"] = target.RcloneRemote()
	} else {
		command = "operations/copyfile"
		payload["srcFs"] = source.RcloneFS()
		payload["srcRemote"] = source.RcloneRemote()
		payload["dstFs"] = target.RcloneFS()
		payload["dstRemote"] = target.RcloneRemote()
	}
	response, err := a.state.Rclone.CallInternal(r.Context(), command, payload)
	if err != nil {
		writeError(w, err)
		return
	}
	if err := mapUpstream(response); err != nil {
		writeError(w, err)
		return
	}
	operation := workspace.OpCopy
	if move {
		operation = workspace.OpMove
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"destructive": move,
		"source":      source,
		"target":      target,
		"impact":      operation.Impact(source.Display(), target.Display()),
	})
}

func (a *api) remotesIfReady(ctx context.Context) ([]string, bool, error) {
	remotes, err := a.state.Rclone.ListRemotes(ctx)
	if err == nil {
		return remotes, true, nil
	}
	var coreErr *core.Error
	if errors.As(err, &coreErr) && coreErr.Kind == core.KindNotRunning {
		return nil, false, nil
	}
	return nil, false, err
}

func (a *api) ensureIdle(edgeIDs []string) error {
	for _, edgeID := range edgeIDs {
		if a.state.Jobs.IsRunning(edgeID) {
			return core.Conflict("edge " + edgeID + " has a running job")
		}
		if a.state.Mounts.IsActive(edgeID) {
			return core.Conflict("edge " + edgeID + " has an active mount")
		}
	}
	return nil
}

type remoteBody struct {
	Name       *string        `json:"name"`
	Type       *string        `json:"type"`
	Parameters map[string]any `json:"parameters"`
}

type fileBody struct {
	FS     string  `json:"fs"`
	Remote *string `json:"remote"`
	Path   *string `json:"path"`
}

type transferBody struct {
	SrcFS     string  `json:"src_fs"`
	SrcRemote *string `json:"src_remote"`
	SrcPath   *string `json:"src_path"`
	DstFS     string  `json:"dst_fs"`
	DstRemote *string `json:"dst_remote"`
	DstPath   *string `json:"dst_path"`
	Directory *bool   `json:"directory"`
}

func fileQuery(r *http.Request, home string) (paths.Locator, error) {
	query := r.URL.Query()
	if !query.Has("fs") || query.Get("fs") == "" {
		return paths.Locator{}, core.InvalidRequest("fs is required")
	}
	return locatorFromBody(query.Get("fs"), queryPtr(query, "remote"), queryPtr(query, "path"), home)
}

func locatorFromBody(fs string, remote, path *string, home string) (paths.Locator, error) {
	var relative string
	var err error
	switch {
	case remote != nil && path != nil && *remote != *path:
		relative, err = paths.JoinRelative(*remote, *path)
	case remote != nil:
		relative = *remote
	case path != nil:
		relative = *path
	}
	if err != nil {
		return paths.Locator{}, err
	}
	return paths.Parse(fs, relative, home)
}

func queryPtr(query interface {
	Has(string) bool
	Get(string) string
}, key string) *string {
	if !query.Has(key) {
		return nil
	}
	value := query.Get(key)
	return &value
}

func revisionQuery(r *http.Request) (uint64, error) {
	raw := r.URL.Query().Get("revision")
	if raw == "" {
		return 0, core.InvalidRequest("revision is required")
	}
	value, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return 0, core.InvalidRequest("revision is invalid")
	}
	return value, nil
}

func mapListItem(item map[string]any) map[string]any {
	if item == nil {
		item = map[string]any{}
	}
	return map[string]any{
		"name":      item["Name"],
		"path":      item["Path"],
		"size":      item["Size"],
		"mime_type": item["MimeType"],
		"mod_time":  item["ModTime"],
		"is_dir":    item["IsDir"],
	}
}

func mapUpstream(response rclone.Response) error {
	if response.OK() {
		return nil
	}
	message := "rclone operation failed"
	if text, ok := response.Body["error"].(string); ok && text != "" {
		message = text
	}
	return &core.Error{Kind: core.KindTransport, Message: message}
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func streamEvents(w http.ResponseWriter, r *http.Request, bus *events.Bus, want func(events.Event) bool) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming is not supported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	eventsCh, cancel := bus.Subscribe()
	defer cancel()
	keepalive := time.NewTicker(15 * time.Second)
	defer keepalive.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-keepalive.C:
			_, _ = io.WriteString(w, ": keepalive\n\n")
			flusher.Flush()
		case ev, ok := <-eventsCh:
			if !ok {
				return
			}
			if !want(ev) {
				continue
			}
			payload, err := json.Marshal(map[string]any{"type": ev.Name, "data": ev.Payload})
			if err != nil {
				continue
			}
			_, _ = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Name, payload)
			flusher.Flush()
		}
	}
}

func withCORS(origins []string, next http.Handler) http.Handler {
	allowed := map[string]struct{}{}
	for _, origin := range origins {
		allowed[origin] = struct{}{}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin != "" {
			if _, ok := allowed[origin]; ok {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept")
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func serveUI(w http.ResponseWriter, r *http.Request, webDir string) {
	if webDir == "" {
		if r.URL.Path == "/" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = io.WriteString(w, `<!doctype html><meta charset="utf-8"><title>Ourboros</title><p>Ourboros API is running. Build the web UI and pass <code>--webui web/dist</code>.</p>`)
			return
		}
		http.NotFound(w, r)
		return
	}
	rel := strings.TrimPrefix(filepath.Clean("/"+r.URL.Path), "/")
	full := filepath.Join(webDir, filepath.FromSlash(rel))
	root := filepath.Clean(webDir)
	if full != root && !strings.HasPrefix(full, root+string(os.PathSeparator)) {
		http.ServeFile(w, r, filepath.Join(webDir, "index.html"))
		return
	}
	info, err := os.Stat(full)
	if err == nil && !info.IsDir() {
		http.ServeFile(w, r, full)
		return
	}
	http.ServeFile(w, r, filepath.Join(webDir, "index.html"))
}
