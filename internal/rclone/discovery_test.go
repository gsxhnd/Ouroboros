package rclone

import "testing"

func TestParseVersionOutput(t *testing.T) {
	got, ok := ParseVersionOutput("rclone v1.74.0\n- os/version: darwin 25.6.0\n")
	if !ok || got != "v1.74.0" {
		t.Fatalf("got %q ok %v", got, ok)
	}
}
