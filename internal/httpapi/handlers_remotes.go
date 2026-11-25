package httpapi

import (
	"context"
	"net/http"
	"strings"

	"github.com/gsxhnd/ourboros/internal/paths"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

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

func (a *api) remotesDelete(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if !validRemoteName(name) {
		badRequest(w, "invalid remote name")
		return
	}
	// 仍被存储节点（同步任务/挂载端点）引用的 remote 不允许删除。
	doc := a.state.Workspace.Get()
	for i := range doc.Nodes {
		node := &doc.Nodes[i]
		if node.Kind == workspace.NodeRemote && node.Remote != nil && node.Remote.Name == name {
			writeAPIError(w, http.StatusConflict, "conflict",
				"remote is referenced by sync tasks or mounts; delete those first",
				map[string]any{"kind": "remote_in_use"})
			return
		}
	}
	response, err := a.state.Rclone.CallInternal(r.Context(), "config/delete", map[string]any{"name": name})
	if err != nil {
		writeError(w, err)
		return
	}
	if err := mapUpstream(response); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": name})
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

// validRemoteName is the lenient check for addressing remotes that already
// exist (get, update, delete), so legacy names created outside Ourboros stay
// manageable. It rejects names that rclone would misinterpret or that our UI
// would mishandle: e.g. "local:", "a:b", names with whitespace or control
// characters, or names that outgrow a filesystem-friendly length.
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
	// New remotes must be names the workspace can reference later, so they follow
	// the same strict rule as sync/mount endpoints.
	if normalized, err := paths.ValidateRemoteName(*body.Name); err != nil || normalized != *body.Name {
		badRequest(w, "remote name must start with a letter or digit and contain only letters, digits, '_', '-' or '.': "+*body.Name)
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
	name := r.PathValue("name")
	if !validRemoteName(name) {
		badRequest(w, "remote name may not contain ':', whitespace, or path-like characters: "+name)
		return
	}
	response, err := a.state.Rclone.CallInternal(r.Context(), "config/update", map[string]any{
		"name":       name,
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
	writeJSON(w, http.StatusOK, map[string]string{"name": name})
}

type remoteBody struct {
	Name       *string        `json:"name"`
	Type       *string        `json:"type"`
	Parameters map[string]any `json:"parameters"`
}
