package app

import (
	"strconv"

	"github.com/gsxhnd/ourboros/internal/netutil"
)

// CORSOrigins lists the browser origins allowed to call the API: the dev
// server, the local server itself, and the bind host when it is not loopback.
func CORSOrigins(host string, port int) []string {
	origins := []string{
		"http://127.0.0.1:1420",
		"http://localhost:1420",
		origin("127.0.0.1", port),
		origin("localhost", port),
	}
	if !netutil.IsLoopbackHost(host) {
		origins = append(origins, origin(host, port))
	}
	return origins
}

func origin(host string, port int) string {
	return "http://" + host + ":" + strconv.Itoa(port)
}
