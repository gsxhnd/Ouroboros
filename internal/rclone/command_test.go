package rclone

import "testing"

func TestJoinRCURL(t *testing.T) {
	got := JoinRCURL("http://127.0.0.1:5572/", "/core/version")
	if got != "http://127.0.0.1:5572/core/version" {
		t.Fatal(got)
	}
}

func TestValidateCommand(t *testing.T) {
	for _, command := range []string{"config/listremotes", "core/version", "operations/list"} {
		if err := ValidateCommand(command); err != nil {
			t.Fatal(command, err)
		}
	}
	for _, command := range []string{"../etc/passwd", "core/version?x=1", "http://example.com", ""} {
		if err := ValidateCommand(command); err == nil {
			t.Fatal("expected rejection", command)
		}
	}
}

func TestValidateProxyCommand(t *testing.T) {
	if err := ValidateProxyCommand("core/version"); err != nil {
		t.Fatal(err)
	}
	if err := ValidateProxyCommand("config/listremotes"); err != nil {
		t.Fatal(err)
	}
	for _, command := range []string{"config/dump", "config/create", "sync/copy", "operations/copyfile"} {
		if err := ValidateProxyCommand(command); err == nil {
			t.Fatal("expected rejection", command)
		}
	}
}
