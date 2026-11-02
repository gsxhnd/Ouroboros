package paths

import (
	"path/filepath"
	"testing"
)

func TestValidateRelativeRejectsTraversal(t *testing.T) {
	if _, err := ValidateRelative("../secret"); err == nil {
		t.Fatal("expected traversal to fail")
	}
	if _, err := ValidateRelative("/etc/passwd"); err == nil {
		t.Fatal("expected absolute path to fail")
	}
	got, err := ValidateRelative("a/./b")
	if err != nil || got != "a/b" {
		t.Fatalf("got %q err %v", got, err)
	}
	got, err = ValidateRelative("")
	if err != nil || got != "" {
		t.Fatalf("empty path: %q %v", got, err)
	}
}

func TestValidateRemoteName(t *testing.T) {
	if got, err := ValidateRemoteName("archive"); err != nil || got != "archive" {
		t.Fatalf("archive: %q %v", got, err)
	}
	if got, err := ValidateRemoteName("s3-backup"); err != nil || got != "s3-backup" {
		t.Fatalf("s3-backup: %q %v", got, err)
	}
	if _, err := ValidateRemoteName("bad/name"); err == nil {
		t.Fatal("expected slash to fail")
	}
	if _, err := ValidateRemoteName(""); err == nil {
		t.Fatal("expected empty to fail")
	}
}

func TestValidateLocal(t *testing.T) {
	home := filepath.Join(string(filepath.Separator), "Users", "example")
	path, err := ValidateLocal(filepath.Join(home, "Backups", "..", "safe"), home)
	if err != nil {
		t.Fatal(err)
	}
	if path != filepath.Join(home, "safe") {
		t.Fatalf("normalized %q", path)
	}
	if _, err := ValidateLocal("relative", home); err == nil {
		t.Fatal("expected relative path to fail")
	}
	expanded, err := ValidateLocal("~/Backups", home)
	if err != nil {
		t.Fatal(err)
	}
	if expanded != filepath.Join(home, "Backups") {
		t.Fatalf("expanded %q", expanded)
	}
}

func TestLocator(t *testing.T) {
	home := filepath.Join(string(filepath.Separator), "Users", "example")
	local, err := Parse(filepath.Join(home, "Backups"), "", home)
	if err != nil {
		t.Fatal(err)
	}
	if local.Kind != KindLocal {
		t.Fatalf("kind %s", local.Kind)
	}
	wantLocal := pathToString(filepath.Join(home, "Backups"))
	if local.CombinedFS() != wantLocal {
		t.Fatalf("local combined %q", local.CombinedFS())
	}

	remote, err := Parse("archive", "ourboros", home)
	if err != nil {
		t.Fatal(err)
	}
	if remote.Kind != KindRemote || remote.CombinedFS() != "archive:ourboros" {
		t.Fatalf("remote %#v", remote)
	}
	if !LooksLikeLocal("/tmp") || LooksLikeLocal("archive") {
		t.Fatal("local detection")
	}
}

func TestJoinRelative(t *testing.T) {
	if got, err := JoinRelative("", "a/b"); err != nil || got != "a/b" {
		t.Fatalf("got %q %v", got, err)
	}
	if got, err := JoinRelative("a", "b"); err != nil || got != "a/b" {
		t.Fatalf("got %q %v", got, err)
	}
	if _, err := JoinRelative("a", "../b"); err == nil {
		t.Fatal("expected traversal to fail")
	}
}
