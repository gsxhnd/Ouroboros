package cli

import (
	"testing"
)

func TestServerAcceptsWebUI(t *testing.T) {
	command, err := Parse([]string{"server", "--webui", "/tmp/ui"})
	if err != nil {
		t.Fatal(err)
	}
	if command.Server.WebDir != "/tmp/ui" || !command.Server.WebDirExplicit {
		t.Fatalf("%#v", command.Server)
	}
	command, err = Parse([]string{"server", "--web-dir", "/tmp/ui"})
	if err != nil {
		t.Fatal(err)
	}
	if command.Server.WebDir != "/tmp/ui" {
		t.Fatal(command.Server.WebDir)
	}
}

func TestHelpMentionsWebUI(t *testing.T) {
	help := Help()
	for _, needle := range []string{"--webui", "--web-dir", "OURBOROS_WEB_DIR"} {
		if !contains(help, needle) {
			t.Fatalf("help missing %s", needle)
		}
	}
}

func TestBindHost(t *testing.T) {
	if err := AssertBindHost("127.0.0.1", ""); err != nil {
		t.Fatal(err)
	}
	if err := AssertBindHost("localhost", ""); err != nil {
		t.Fatal(err)
	}
	if err := AssertBindHost("0.0.0.0", ""); err == nil {
		t.Fatal("expected non-loopback without token to fail")
	}
	if err := AssertBindHost("192.168.1.10", ""); err == nil {
		t.Fatal("expected lan address without token to fail")
	}
	// 配置了 token 后才允许非回环绑定（Docker / NAS 场景）。
	if err := AssertBindHost("0.0.0.0", "secret"); err != nil {
		t.Fatal(err)
	}
	if err := AssertBindHost("192.168.1.10", "secret"); err != nil {
		t.Fatal(err)
	}
}

func TestAuthTokenFlag(t *testing.T) {
	command, err := Parse([]string{"server", "--auth-token", "abc123"})
	if err != nil {
		t.Fatal(err)
	}
	if command.Server.AuthToken != "abc123" {
		t.Fatalf("token = %q", command.Server.AuthToken)
	}
	command, err = Parse([]string{"server", "--auth-token=xyz"})
	if err != nil {
		t.Fatal(err)
	}
	if command.Server.AuthToken != "xyz" {
		t.Fatalf("token = %q", command.Server.AuthToken)
	}
	if help := Help(); !contains(help, "--auth-token") || !contains(help, "OURBOROS_TOKEN") {
		t.Fatal("help should document --auth-token / OURBOROS_TOKEN")
	}
}

func contains(text, needle string) bool {
	return len(text) >= len(needle) && (text == needle || len(needle) == 0 || (len(text) > 0 && (indexOf(text, needle) >= 0)))
}

func indexOf(text, needle string) int {
	for i := 0; i+len(needle) <= len(text); i++ {
		if text[i:i+len(needle)] == needle {
			return i
		}
	}
	return -1
}
