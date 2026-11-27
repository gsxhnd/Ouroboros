package service

import (
	"context"
	"io"
	"path/filepath"
	"strings"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/paths"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

type FileQuery struct {
	FS     string
	Remote *string
	Path   *string
}

type FileBody struct {
	FS     string  `json:"fs"`
	Remote *string `json:"remote"`
	Path   *string `json:"path"`
}

type TransferBody struct {
	SrcFS     string  `json:"src_fs"`
	SrcRemote *string `json:"src_remote"`
	SrcPath   *string `json:"src_path"`
	DstFS     string  `json:"dst_fs"`
	DstRemote *string `json:"dst_remote"`
	DstPath   *string `json:"dst_path"`
	Directory *bool   `json:"directory"`
}

type FileList struct {
	FS     string           `json:"fs"`
	Remote string           `json:"remote"`
	Items  []map[string]any `json:"items"`
}

type DirectoryResult struct {
	FS          string `json:"fs"`
	Remote      string `json:"remote"`
	Destructive bool   `json:"destructive"`
	Impact      string `json:"impact"`
}

type DeleteResult struct {
	FS          string        `json:"fs"`
	Remote      string        `json:"remote"`
	Destructive bool          `json:"destructive"`
	Source      paths.Locator `json:"source"`
	Impact      string        `json:"impact"`
}

type TransferResult struct {
	Destructive bool          `json:"destructive"`
	Source      paths.Locator `json:"source"`
	Target      paths.Locator `json:"target"`
	Impact      string        `json:"impact"`
}

type DownloadStream struct {
	Name        string
	ContentType string
	Size        int64
	Body        io.ReadCloser
}

type Files struct{ serviceBase }

func (s *Files) List(ctx context.Context, query FileQuery) (FileList, error) {
	locator, err := s.locatorFromQuery(query)
	if err != nil {
		return FileList{}, err
	}
	response, err := s.state.Rclone.CallInternal(ctx, "operations/list", map[string]any{
		"fs":     locator.RcloneFS(),
		"remote": locator.RcloneRemote(),
	})
	if err != nil {
		return FileList{}, err
	}
	if err := mapUpstream(response); err != nil {
		return FileList{}, err
	}
	items := []map[string]any{}
	if raw, ok := response.Body["list"].([]any); ok {
		items = make([]map[string]any, 0, len(raw))
		for _, item := range raw {
			object, _ := item.(map[string]any)
			items = append(items, mapListItem(object))
		}
	}
	return FileList{FS: locator.FS, Remote: locator.Remote, Items: items}, nil
}

func (s *Files) Mkdir(ctx context.Context, body FileBody) (DirectoryResult, error) {
	locator, err := s.locator(body.FS, body.Remote, body.Path)
	if err != nil {
		return DirectoryResult{}, err
	}
	response, err := s.state.Rclone.CallInternal(ctx, "operations/mkdir", map[string]any{
		"fs":     locator.RcloneFS(),
		"remote": locator.RcloneRemote(),
	})
	if err != nil {
		return DirectoryResult{}, err
	}
	if err := mapUpstream(response); err != nil {
		return DirectoryResult{}, err
	}
	return DirectoryResult{
		FS:          locator.FS,
		Remote:      locator.Remote,
		Destructive: false,
		Impact:      "Create directory " + locator.Display(),
	}, nil
}

func (s *Files) Delete(ctx context.Context, query FileQuery, purge bool) (DeleteResult, error) {
	locator, err := s.locatorFromQuery(query)
	if err != nil {
		return DeleteResult{}, err
	}
	command := "operations/deletefile"
	if purge {
		command = "operations/purge"
	}
	response, err := s.state.Rclone.CallInternal(ctx, command, map[string]any{
		"fs":     locator.RcloneFS(),
		"remote": locator.RcloneRemote(),
	})
	if err != nil {
		return DeleteResult{}, err
	}
	if err := mapUpstream(response); err != nil {
		return DeleteResult{}, err
	}
	impact := "Delete file " + locator.Display() + "."
	if purge {
		impact = "Permanently delete " + locator.Display() + " and all of its contents."
	}
	return DeleteResult{
		FS:          locator.FS,
		Remote:      locator.Remote,
		Destructive: true,
		Source:      locator,
		Impact:      impact,
	}, nil
}

func (s *Files) Copy(ctx context.Context, body TransferBody) (TransferResult, error) {
	return s.transfer(ctx, body, false)
}

func (s *Files) Move(ctx context.Context, body TransferBody) (TransferResult, error) {
	return s.transfer(ctx, body, true)
}

func (s *Files) transfer(ctx context.Context, body TransferBody, move bool) (TransferResult, error) {
	source, err := s.locator(body.SrcFS, body.SrcRemote, body.SrcPath)
	if err != nil {
		return TransferResult{}, err
	}
	target, err := s.locator(body.DstFS, body.DstRemote, body.DstPath)
	if err != nil {
		return TransferResult{}, err
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
	response, err := s.state.Rclone.CallInternal(ctx, command, payload)
	if err != nil {
		return TransferResult{}, err
	}
	if err := mapUpstream(response); err != nil {
		return TransferResult{}, err
	}
	operation := workspace.OpCopy
	if move {
		operation = workspace.OpMove
	}
	return TransferResult{
		Destructive: move,
		Source:      source,
		Target:      target,
		Impact:      operation.Impact(source.Display(), target.Display()),
	}, nil
}

// OpenDownload validates that the target is a file and returns the upstream
// stream. Writing transport headers and copying the body remain bridge duties.
func (s *Files) OpenDownload(ctx context.Context, query FileQuery) (*DownloadStream, error) {
	locator, err := s.locatorFromQuery(query)
	if err != nil {
		return nil, err
	}
	if locator.Remote == "" || strings.Contains(locator.Remote, "/") {
		return nil, invalidRequest("download requires the name of a file inside the current directory")
	}
	name := filepath.Base(locator.Remote)
	response, err := s.state.Rclone.CallInternal(ctx, "operations/stat", map[string]any{
		"fs":     locator.RcloneFS(),
		"remote": locator.RcloneRemote(),
	})
	if err != nil {
		return nil, err
	}
	if err := mapUpstream(response); err != nil {
		return nil, err
	}
	item, _ := response.Body["item"].(map[string]any)
	if item == nil {
		return nil, core.NotFound("file " + locator.Display())
	}
	if isDir, _ := item["IsDir"].(bool); isDir {
		return nil, invalidRequest("directories cannot be downloaded: " + name)
	}
	stream, err := s.state.Rclone.OpenServe(ctx, locator)
	if err != nil {
		return nil, err
	}
	return &DownloadStream{
		Name:        name,
		ContentType: stream.Header.Get("Content-Type"),
		Size:        stream.ContentLength,
		Body:        stream.Body,
	}, nil
}

func (s *Files) locatorFromQuery(query FileQuery) (paths.Locator, error) {
	if query.FS == "" {
		return paths.Locator{}, core.InvalidRequest("fs is required")
	}
	return s.locator(query.FS, query.Remote, query.Path)
}

func (s *Files) locator(fs string, remote, path *string) (paths.Locator, error) {
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
	return paths.Parse(fs, relative, s.state.HomeDir)
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
