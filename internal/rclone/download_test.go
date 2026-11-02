package rclone

import "testing"

func TestParseSHA256Sums(t *testing.T) {
	manifest := "abc123  rclone-v1.74.0-osx-arm64.zip\ndef456 *rclone-v1.74.0-linux-amd64.zip\n"
	got, err := ParseSHA256Sums(manifest, "rclone-v1.74.0-osx-arm64.zip")
	if err != nil || got != "abc123" {
		t.Fatalf("got %q %v", got, err)
	}
	got, err = ParseSHA256Sums(manifest, "rclone-v1.74.0-linux-amd64.zip")
	if err != nil || got != "def456" {
		t.Fatalf("got %q %v", got, err)
	}
	if _, err := ParseSHA256Sums(manifest, "missing.zip"); err == nil {
		t.Fatal("expected missing file to fail")
	}
}

func TestSHA256Hex(t *testing.T) {
	if got := sha256Hex([]byte("hello")); got != "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824" {
		t.Fatal(got)
	}
}
