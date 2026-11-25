// Package netutil holds small network helpers shared by packages that must
// not depend on each other.
package netutil

// IsLoopbackHost reports whether host names the local machine only. It
// accepts the bare or bracketed forms of IPv6 loopback.
func IsLoopbackHost(host string) bool {
	switch host {
	case "127.0.0.1", "localhost", "::1", "[::1]":
		return true
	default:
		return false
	}
}
