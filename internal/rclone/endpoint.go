package rclone

import (
	"net/url"
	"strings"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/netutil"
)

// PublicEndpoint is an RC address with userinfo removed.
func PublicEndpoint(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return ""
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return ""
	}
	parsed.User = nil
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return strings.TrimRight(parsed.String(), "/")
}

func ParseAttachURL(raw string) (string, *Auth, error) {
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", nil, core.InvalidRequest("invalid rclone RC URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", nil, core.InvalidRequest("rclone RC URL must be http or https")
	}
	host := parsed.Hostname()
	if host == "" {
		return "", nil, core.InvalidRequest("rclone RC URL is missing a host")
	}
	if !netutil.IsLoopbackHost(host) {
		return "", nil, core.InvalidRequest("rclone RC must listen on a loopback address")
	}
	var auth *Auth
	if parsed.User != nil && parsed.User.Username() != "" {
		pass, _ := parsed.User.Password()
		auth = &Auth{User: parsed.User.Username(), Pass: pass}
	}
	parsed.User = nil
	return strings.TrimRight(parsed.String(), "/"), auth, nil
}
