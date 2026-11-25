package netutil

import "testing"

func TestIsLoopbackHost(t *testing.T) {
	for _, host := range []string{"127.0.0.1", "localhost", "::1", "[::1]"} {
		if !IsLoopbackHost(host) {
			t.Errorf("IsLoopbackHost(%q) = false", host)
		}
	}
	for _, host := range []string{"", "0.0.0.0", "192.168.1.10", "example.com", "127.0.0.2"} {
		if IsLoopbackHost(host) {
			t.Errorf("IsLoopbackHost(%q) = true", host)
		}
	}
}
