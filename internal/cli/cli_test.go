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
	if err := AssertBindHost("127.0.0.1"); err != nil {
		t.Fatal(err)
	}
	if err := AssertBindHost("localhost"); err != nil {
		t.Fatal(err)
	}
	if err := AssertBindHost("0.0.0.0"); err == nil {
		t.Fatal("expected non-loopback to fail")
	}
	if err := AssertBindHost("192.168.1.10"); err == nil {
		t.Fatal("expected lan address to fail")
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
