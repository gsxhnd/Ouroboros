package rclone

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/paths"
	"github.com/gsxhnd/ourboros/internal/version"
)

// serveClient streams file bodies between the browser and the RC file server.
// It has no overall timeout so large downloads can finish; cancellation comes
// from the caller's request context instead.
var serveClient = &http.Client{}

// OpenServe performs an authenticated GET against the RC file server (enabled
// by --rc-serve on spawned daemons) for the file at locator and returns the
// raw response so the caller can stream the body to the browser. Credentials
// are only ever sent to the loopback RC process and never appear in returned
// URLs, logs or error text.
func (s *Supervisor) OpenServe(ctx context.Context, locator paths.Locator) (*http.Response, error) {
	s.reap()
	rcURL, auth, err := s.endpoint()
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, JoinRCURL(rcURL, serveFilePath(locator)), nil)
	if err != nil {
		return nil, core.Transport(redactAuth(err.Error(), auth))
	}
	req.Header.Set("User-Agent", "ourboros/"+version.Version)
	if auth != nil {
		req.SetBasicAuth(auth.User, auth.Pass)
	}
	res, err := serveClient.Do(req)
	if err != nil {
		return nil, core.Transport(redactAuth(err.Error(), auth))
	}
	if res.StatusCode != http.StatusOK {
		res.Body.Close()
		return nil, core.Transport(fmt.Sprintf("rclone file server returned status %d", res.StatusCode))
	}
	return res, nil
}

// serveFilePath builds the URL path the RC file server serves for locator:
// the fs is wrapped in [] (the serve URL syntax for a remote root) and every
// path segment is escaped individually, keeping "/..." separators intact. The
// result only ever leaves the server process; the browser uses /api/files/.
func serveFilePath(locator paths.Locator) string {
	inner := locator.FS
	if locator.Kind == paths.KindRemote {
		inner += ":"
	}
	var builder strings.Builder
	builder.WriteString("/%5B")
	segments := strings.Split(inner, "/")
	for index, segment := range segments {
		if index > 0 {
			builder.WriteString("/")
		}
		builder.WriteString(url.PathEscape(segment))
	}
	builder.WriteString("%5D")
	for _, segment := range strings.Split(locator.Remote, "/") {
		if segment == "" {
			continue
		}
		builder.WriteString("/")
		builder.WriteString(url.PathEscape(segment))
	}
	return builder.String()
}
