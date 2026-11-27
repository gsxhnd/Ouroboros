package service

import (
	"context"
	"strings"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/paths"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

type RemoteInfo struct {
	Name string `json:"name"`
	Type string `json:"type,omitempty"`
}

type RemoteDetail struct {
	Name       string         `json:"name"`
	Type       string         `json:"type"`
	Parameters map[string]any `json:"parameters"`
}

type RemoteBody struct {
	Name       *string        `json:"name"`
	Type       *string        `json:"type"`
	Parameters map[string]any `json:"parameters"`
}

type Remotes struct{ serviceBase }

func (s *Remotes) List(ctx context.Context) ([]RemoteInfo, error) {
	remotes, err := s.state.Rclone.ListRemotes(ctx)
	if err != nil {
		return nil, err
	}
	types := map[string]string{}
	if dump, dumpErr := s.state.Rclone.CallInternal(ctx, "config/dump", map[string]any{}); dumpErr == nil && dump.OK() {
		types = rclone.RemoteTypes(dump.Body)
	}
	items := make([]RemoteInfo, 0, len(remotes))
	for _, name := range remotes {
		items = append(items, RemoteInfo{Name: name, Type: types[name]})
	}
	return items, nil
}

func (s *Remotes) Providers(ctx context.Context) ([]rclone.Provider, error) {
	response, err := s.state.Rclone.CallInternal(ctx, "config/providers", map[string]any{})
	if err != nil {
		return nil, err
	}
	if err := mapUpstream(response); err != nil {
		return nil, err
	}
	return rclone.ParseProviders(response.Body)
}

func (s *Remotes) Get(ctx context.Context, name string) (RemoteDetail, error) {
	response, err := s.state.Rclone.CallInternal(ctx, "config/get", map[string]any{"name": name})
	if err != nil {
		return RemoteDetail{}, err
	}
	if err := mapUpstream(response); err != nil {
		return RemoteDetail{}, err
	}
	typeName, _ := response.Body["type"].(string)
	parameters := map[string]any{}
	if providers, err := s.Providers(ctx); err == nil {
		parameters = rclone.PublicParameters(providers, typeName, response.Body)
	}
	return RemoteDetail{Name: name, Type: typeName, Parameters: parameters}, nil
}

func (s *Remotes) Create(ctx context.Context, body RemoteBody) (string, error) {
	if body.Name == nil || *body.Name == "" {
		return "", invalidRequest("remote name is required")
	}
	// New remotes must be names the workspace can reference later, so they
	// follow the same strict rule as sync/mount endpoints.
	if normalized, err := paths.ValidateRemoteName(*body.Name); err != nil || normalized != *body.Name {
		return "", invalidRequest("remote name must start with a letter or digit and contain only letters, digits, '_', '-' or '.': " + *body.Name)
	}
	if body.Type == nil || *body.Type == "" {
		return "", invalidRequest("remote type is required")
	}
	if body.Parameters == nil {
		body.Parameters = map[string]any{}
	}
	response, err := s.state.Rclone.CallInternal(ctx, "config/create", map[string]any{
		"name":       *body.Name,
		"type":       *body.Type,
		"parameters": body.Parameters,
		"opt":        map[string]any{"nonInteractive": true, "obscure": true},
	})
	if err != nil {
		return "", err
	}
	if err := mapUpstream(response); err != nil {
		return "", err
	}
	return *body.Name, nil
}

func (s *Remotes) Update(ctx context.Context, name string, body RemoteBody) error {
	if !validRemoteName(name) {
		return invalidRequest("remote name may not contain ':', whitespace, or path-like characters: " + name)
	}
	if body.Parameters == nil {
		body.Parameters = map[string]any{}
	}
	response, err := s.state.Rclone.CallInternal(ctx, "config/update", map[string]any{
		"name":       name,
		"parameters": body.Parameters,
		"opt":        map[string]any{"nonInteractive": true, "obscure": true},
	})
	if err != nil {
		return err
	}
	return mapUpstream(response)
}

func (s *Remotes) Delete(ctx context.Context, name string) error {
	if !validRemoteName(name) {
		return invalidRequest("invalid remote name")
	}
	// A remote referenced by storage nodes (sync tasks/mount endpoints) must
	// not be deleted underneath those rules.
	doc := s.state.Workspace.Get()
	for i := range doc.Nodes {
		node := &doc.Nodes[i]
		if node.Kind == workspace.NodeRemote && node.Remote != nil && node.Remote.Name == name {
			return core.ConflictDetailExact(
				"remote is referenced by sync tasks or mounts; delete those first",
				map[string]any{"kind": "remote_in_use"},
			)
		}
	}
	response, err := s.state.Rclone.CallInternal(ctx, "config/delete", map[string]any{"name": name})
	if err != nil {
		return err
	}
	return mapUpstream(response)
}

// validRemoteName is the lenient check for addressing remotes that already
// exist, so legacy names created outside Ourboros stay manageable.
func validRemoteName(name string) bool {
	if name == "" || len(name) > 255 {
		return false
	}
	if strings.TrimSpace(name) != name {
		return false
	}
	if strings.Contains(name, ":") {
		return false
	}
	return !strings.ContainsFunc(name, func(r rune) bool {
		return r < 0x20 || r == 0x7f || r == ' ' || r == '"' || r == '\\' || r == '/'
	})
}
