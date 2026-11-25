package httpapi

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/gsxhnd/ourboros/internal/core"
)

// withAuth protects the typed API when the server is exposed beyond loopback
// (--auth-token set). The token comes from the Authorization: Bearer header,
// with an access_token query fallback for EventSource, which cannot set
// headers. Comparison is constant-time. With an empty token the middleware is
// a passthrough, keeping desktop and local-browser behavior unchanged.
func withAuth(token string, origins []string, next http.Handler) http.Handler {
	if token == "" {
		return next
	}
	allowed := map[string]struct{}{}
	for _, origin := range origins {
		allowed[origin] = struct{}{}
	}
	expected := []byte(token)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !originAllowed(r, allowed) {
			writeAPIError(w, http.StatusForbidden, "forbidden", "cross-origin requests are not allowed", map[string]any{})
			return
		}
		if bearerToken(r) == "" || subtle.ConstantTimeCompare([]byte(bearerToken(r)), expected) != 1 {
			w.Header().Set("WWW-Authenticate", `Bearer realm="ourboros"`)
			writeError(w, core.Unauthorized())
			return
		}
		next.ServeHTTP(w, r)
	})
}

// originAllowed hardens the query-parameter token path: a browser page on
// another origin could drive SSE with a leaked token, so cross-origin requests
// are rejected unless the origin is explicitly allowed or is the served host.
func originAllowed(r *http.Request, allowed map[string]struct{}) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	if _, ok := allowed[origin]; ok {
		return true
	}
	// Same-host pages (the self-hosted UI) are always trusted.
	for _, scheme := range []string{"http://", "https://"} {
		if origin == scheme+r.Host {
			return true
		}
	}
	return false
}

func bearerToken(r *http.Request) string {
	header := r.Header.Get("Authorization")
	if token, ok := strings.CutPrefix(header, "Bearer "); ok {
		return strings.TrimSpace(token)
	}
	if header == "" {
		return r.URL.Query().Get("access_token")
	}
	return ""
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
