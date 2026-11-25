package httpapi

import (
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/paths"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

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

// filesDownload streams a single file to the browser through the loopback RC
// file server. It validates the locator, confirms the target is a file (not a
// directory) via operations/stat, and then streams the upstream body without
// buffering it in memory.
func (a *api) filesDownload(w http.ResponseWriter, r *http.Request) {
	locator, err := fileQuery(r, a.state.HomeDir)
	if err != nil {
		writeError(w, err)
		return
	}
	if locator.Remote == "" || strings.Contains(locator.Remote, "/") {
		badRequest(w, "download requires the name of a file inside the current directory")
		return
	}
	name := filepath.Base(locator.Remote)
	res, err := a.state.Rclone.CallInternal(r.Context(), "operations/stat", map[string]any{
		"fs":     locator.RcloneFS(),
		"remote": locator.RcloneRemote(),
	})
	if err != nil {
		writeError(w, err)
		return
	}
	if err := mapUpstream(res); err != nil {
		writeError(w, err)
		return
	}
	item, _ := res.Body["item"].(map[string]any)
	if item == nil {
		writeError(w, core.NotFound("file "+locator.Display()))
		return
	}
	if isDir, _ := item["IsDir"].(bool); isDir {
		badRequest(w, "directories cannot be downloaded: "+name)
		return
	}
	stream, err := a.state.Rclone.OpenServe(r.Context(), locator)
	if err != nil {
		writeError(w, err)
		return
	}
	defer stream.Body.Close()
	disposition := mime.FormatMediaType("attachment", map[string]string{"filename": name})
	if disposition != "" {
		w.Header().Set("Content-Disposition", disposition)
	}
	if contentType := stream.Header.Get("Content-Type"); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	if length := stream.Header.Get("Content-Length"); length != "" {
		w.Header().Set("Content-Length", length)
	}
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, stream.Body)
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
