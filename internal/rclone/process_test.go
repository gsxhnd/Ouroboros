package rclone

import (
	"os/exec"
	"runtime"
	"testing"
	"time"
)

func TestParseAttachURL(t *testing.T) {
	raw, auth, err := ParseAttachURL("http://user:secret@127.0.0.1:5572")
	if err != nil {
		t.Fatal(err)
	}
	if raw != "http://127.0.0.1:5572" {
		t.Fatal(raw)
	}
	if auth == nil || auth.User != "user" || auth.Pass != "secret" {
		t.Fatalf("auth %#v", auth)
	}
	if _, _, err := ParseAttachURL("http://192.168.1.10:5572"); err == nil {
		t.Fatal("expected non-loopback to fail")
	}
	if !IsLoopbackHost("localhost") {
		t.Fatal("localhost")
	}
}

func TestRandomTokenUsesAlphabetAndLength(t *testing.T) {
	token, err := randomToken(64)
	if err != nil {
		t.Fatal(err)
	}
	if len(token) != 64 {
		t.Fatalf("len = %d", len(token))
	}
	for _, ch := range token {
		if !(ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch >= '0' && ch <= '9') {
			t.Fatalf("unexpected character %q in token", ch)
		}
	}
}

func TestChildStopInterruptsRunningProcess(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("uses POSIX signals")
	}
	cmd := exec.Command("sleep", "30")
	child, err := startCommand(cmd)
	if err != nil {
		t.Skip("sleep not available:", err)
	}
	started := time.Now()
	child.stop(5 * time.Second)
	if !child.exited() {
		t.Fatal("process still running after stop")
	}
	if elapsed := time.Since(started); elapsed > 4*time.Second {
		t.Fatalf("stop took %s; SIGINT should end sleep immediately", elapsed)
	}
}
