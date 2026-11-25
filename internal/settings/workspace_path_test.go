package settings

import (
	"path/filepath"
	"testing"
)

func TestResolveWorkspacePath(t *testing.T) {
	data := filepath.Join(string(filepath.Separator), "data")
	abs := filepath.Join(string(filepath.Separator), "elsewhere", "ws.json")
	empty := ""
	relative := filepath.Join("sub", "ws.json")

	cases := []struct {
		name string
		path *string
		want string
	}{
		{"unset uses the data dir default", nil, filepath.Join(data, "workspace.json")},
		{"empty string uses the default", &empty, filepath.Join(data, "workspace.json")},
		{"relative is taken from the data dir", &relative, filepath.Join(data, "sub", "ws.json")},
		{"absolute is used as is", &abs, abs},
	}
	for _, tc := range cases {
		doc := Document{WorkspacePath: tc.path}
		if got := doc.ResolveWorkspacePath(data); got != tc.want {
			t.Errorf("%s: got %q, want %q", tc.name, got, tc.want)
		}
	}
}
