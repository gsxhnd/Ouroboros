package rclone

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gsxhnd/ourboros/internal/paths"
)

func TestServeFilePath(t *testing.T) {
	cases := []struct {
		name    string
		locator paths.Locator
		want    string
	}{
		{"remote root file", paths.Locator{Kind: paths.KindRemote, FS: "gdrive", Remote: "a.txt"}, "/%5Bgdrive:%5D/a.txt"},
		{"remote nested", paths.Locator{Kind: paths.KindRemote, FS: "gdrive", Remote: "dir/sub/a.txt"}, "/%5Bgdrive:%5D/dir/sub/a.txt"},
		{"local absolute fs", paths.Locator{Kind: paths.KindLocal, FS: "/data/files", Remote: "a.txt"}, "/%5B/data/files%5D/a.txt"},
		{"segments are escaped", paths.Locator{Kind: paths.KindRemote, FS: "gdrive", Remote: "my dir/a#b?.txt"}, "/%5Bgdrive:%5D/my%20dir/a%23b%3F.txt"},
		{"leading and doubled slashes dropped", paths.Locator{Kind: paths.KindRemote, FS: "gdrive", Remote: "/dir//a.txt"}, "/%5Bgdrive:%5D/dir/a.txt"},
		{"empty remote path is the root", paths.Locator{Kind: paths.KindRemote, FS: "gdrive"}, "/%5Bgdrive:%5D"},
	}
	for _, tc := range cases {
		if got := serveFilePath(tc.locator); got != tc.want {
			t.Errorf("%s: got %q, want %q", tc.name, got, tc.want)
		}
	}
}

// attachedTo returns a Supervisor attached to an RC endpoint at rawURL. The
// endpoint must answer core/version, which Start uses to confirm it is up.
func attachedTo(t *testing.T, rawURL string) *Supervisor {
	t.Helper()
	supervisor := NewSupervisor(Settings{Bin: "rclone", RCURL: rawURL})
	if _, err := supervisor.Start(context.Background()); err != nil {
		t.Fatalf("attach to %s: %v", rawURL, err)
	}
	return supervisor
}

func withCredentials(serverURL string) string {
	return strings.Replace(serverURL, "http://", "http://user:secret@", 1)
}

func TestOpenServeSendsCredentialsAndStreamsBody(t *testing.T) {
	var gotPath, gotUser, gotPass string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.EscapedPath()
		gotUser, gotPass, _ = r.BasicAuth()
		_, _ = io.WriteString(w, "file-body")
	}))
	defer server.Close()
	supervisor := attachedTo(t, withCredentials(server.URL))

	res, err := supervisor.OpenServe(context.Background(),
		paths.Locator{Kind: paths.KindRemote, FS: "gdrive", Remote: "dir/a b.txt"})
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if string(body) != "file-body" {
		t.Fatalf("body = %q", body)
	}
	if gotPath != "/%5Bgdrive:%5D/dir/a%20b.txt" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotUser != "user" || gotPass != "secret" {
		t.Fatalf("credentials not sent: %q/%q", gotUser, gotPass)
	}
}

func TestOpenServeReportsNonOKWithoutLeakingCredentials(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/core/version" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"version":"v1.70.0"}`)
			return
		}
		http.Error(w, "nope", http.StatusNotFound)
	}))
	defer server.Close()
	supervisor := attachedTo(t, withCredentials(server.URL))

	_, err := supervisor.OpenServe(context.Background(), paths.Locator{Kind: paths.KindRemote, FS: "gdrive", Remote: "x"})
	if err == nil || !strings.Contains(err.Error(), "404") {
		t.Fatalf("err = %v", err)
	}
	if strings.Contains(err.Error(), "secret") {
		t.Fatalf("credentials leaked into error: %v", err)
	}
}

func TestListRemotes(t *testing.T) {
	respond := func(body string) *Supervisor {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/config/listremotes" {
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, body)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"version":"v1.70.0"}`)
		}))
		t.Cleanup(server.Close)
		return attachedTo(t, server.URL)
	}

	got, err := respond(`{"remotes":["gdrive","s3"]}`).ListRemotes(context.Background())
	if err != nil || len(got) != 2 || got[0] != "gdrive" || got[1] != "s3" {
		t.Fatalf("got (%v, %v)", got, err)
	}
	got, err = respond(`{}`).ListRemotes(context.Background())
	if err != nil || got == nil || len(got) != 0 {
		t.Fatalf("missing key: got (%v, %v), want empty non-nil slice", got, err)
	}
}
