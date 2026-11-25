package httpapi

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gsxhnd/ourboros/internal/app"
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
	mux.HandleFunc("POST /api/workspace/nodes", api.workspaceCreateNode)
	mux.HandleFunc("DELETE /api/workspace/nodes/{id}", api.workspaceDeleteNode)
	mux.HandleFunc("GET /api/remotes/providers", api.remotesProviders)
	mux.HandleFunc("GET /api/remotes", api.remotesList)
	mux.HandleFunc("POST /api/remotes", api.remotesCreate)
	mux.HandleFunc("GET /api/remotes/{name}", api.remotesGet)
	mux.HandleFunc("PATCH /api/remotes/{name}", api.remotesUpdate)
	mux.HandleFunc("DELETE /api/remotes/{name}", api.remotesDelete)
	mux.HandleFunc("GET /api/files", api.filesList)
	mux.HandleFunc("GET /api/files/download", api.filesDownload)
	mux.HandleFunc("DELETE /api/files", api.filesDelete)
	mux.HandleFunc("POST /api/files/mkdir", api.filesMkdir)
	mux.HandleFunc("POST /api/files/copy", api.filesCopy)
	mux.HandleFunc("POST /api/files/move", api.filesMove)
	mux.HandleFunc("POST /api/sync/{edge_id}/run", api.syncRun)
	mux.HandleFunc("GET /api/sync/tasks", api.syncTasksList)
	mux.HandleFunc("POST /api/sync/tasks", api.syncTasksCreate)
	mux.HandleFunc("PATCH /api/sync/tasks/{id}", api.syncTasksPatch)
	mux.HandleFunc("DELETE /api/sync/tasks/{id}", api.syncTasksDelete)
	mux.HandleFunc("POST /api/sync/tasks/{id}/run", api.syncRun)
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

	// /health 与静态 UI 不做鉴权：探针需要 /health，浏览器需要先拿到页面才能
	// 输入 token。所有 /api 请求在配置了 token 时必须携带凭证。
	apiRoutes := withAuth(state.AuthToken, state.Origins, mux)
	return withCORS(state.Origins, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			mux.ServeHTTP(w, r)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api") {
			apiRoutes.ServeHTTP(w, r)
			return
		}
		serveUI(w, r, webDir)
	}))
}

type api struct{ state *app.State }

func serveUI(w http.ResponseWriter, r *http.Request, webDir string) {
	if webDir == "" {
		if r.URL.Path == "/" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = io.WriteString(w, `<!doctype html><meta charset="utf-8"><title>Ourboros</title><p>Ourboros API is running. Build the web UI and pass <code>--webui frontend/dist</code>.</p>`)
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
