package app

import (
	"errors"
	"path/filepath"
	"testing"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/settings"
)

func ptr[T any](v T) *T { return &v }

func TestRcloneSettingsFromUsesDocument(t *testing.T) {
	doc := settings.DefaultDocument()
	doc.RcloneBin = ptr("/opt/rclone")
	doc.RcloneConfig = ptr("/etc/rclone.conf")
	doc.RcloneRCURL = ptr("http://127.0.0.1:5572")

	got := rcloneSettingsFrom(doc, Config{})
	if got.Bin != "/opt/rclone" || got.Config != "/etc/rclone.conf" || got.RCURL != "http://127.0.0.1:5572" {
		t.Fatalf("settings = %+v", got)
	}
}

func TestRcloneSettingsFromDefaultsToSystemRclone(t *testing.T) {
	got := rcloneSettingsFrom(settings.DefaultDocument(), Config{})
	if got.Bin != "rclone" || got.Config != "" || got.RCURL != "" {
		t.Fatalf("settings = %+v", got)
	}
}

func TestRcloneSettingsFromCLIWinsOverDocument(t *testing.T) {
	doc := settings.DefaultDocument()
	doc.RcloneBin = ptr("/opt/rclone")
	doc.RcloneConfig = ptr("/etc/rclone.conf")
	doc.RcloneRCURL = ptr("http://127.0.0.1:5572")

	got := rcloneSettingsFrom(doc, Config{
		RcloneBin: "/cli/rclone", RcloneConfig: "/cli/rclone.conf", RcloneURL: "http://127.0.0.1:9999",
		RcloneUser: "u", RclonePass: "p",
	})
	want := rclone.Settings{
		Bin: "/cli/rclone", Config: "/cli/rclone.conf", RCURL: "http://127.0.0.1:9999", RCUser: "u", RCPass: "p",
	}
	if got != want {
		t.Fatalf("settings = %+v, want %+v", got, want)
	}
}

func newTestState(t *testing.T, cfg Config) *State {
	t.Helper()
	cfg.DataDir = filepath.Join(t.TempDir(), "data")
	state, err := New(nil, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(state.Close)
	return state
}

func TestApplySettingsSkipsCLIPinnedFields(t *testing.T) {
	state := newTestState(t, Config{RcloneBin: "/cli/rclone"})
	doc := settings.DefaultDocument()
	doc.RcloneBin = ptr("/from/settings")
	doc.RcloneConfig = ptr("/from/settings.conf")

	state.ApplySettings(doc)

	got := state.Rclone.Settings()
	if got.Bin != "/cli/rclone" {
		t.Fatalf("CLI-pinned bin was overwritten: %q", got.Bin)
	}
	if got.Config != "/from/settings.conf" {
		t.Fatalf("unpinned config not applied: %q", got.Config)
	}
}

func TestApplySettingsClearsRemovedValues(t *testing.T) {
	state := newTestState(t, Config{})
	state.ApplySettings(func() settings.Document {
		d := settings.DefaultDocument()
		d.RcloneConfig = ptr("/a.conf")
		d.RcloneRCURL = ptr("http://127.0.0.1:1")
		return d
	}())
	state.ApplySettings(settings.DefaultDocument())

	got := state.Rclone.Settings()
	if got.Config != "" || got.RCURL != "" {
		t.Fatalf("cleared values still set: %+v", got)
	}
}

func TestCheckSettingsPatchRejectsPinnedFields(t *testing.T) {
	state := newTestState(t, Config{RcloneBin: "/cli/rclone", RcloneConfig: "/cli/c", RcloneURL: "http://127.0.0.1:2"})
	for name, patch := range map[string]settings.Patch{
		"bin":    {RcloneBin: settings.Nullable[string]{Set: true, Value: ptr("x")}},
		"config": {RcloneConfig: settings.Nullable[string]{Set: true, Value: ptr("x")}},
		"url":    {RcloneRCURL: settings.Nullable[string]{Set: true, Value: ptr("x")}},
	} {
		err := state.CheckSettingsPatch(patch)
		var coreErr *core.Error
		if !errors.As(err, &coreErr) || coreErr.Kind != core.KindConflict || coreErr.Detail("kind") != "cli_override" {
			t.Fatalf("%s: err = %v", name, err)
		}
	}
	if err := state.CheckSettingsPatch(settings.Patch{AutoStart: ptr(true)}); err != nil {
		t.Fatalf("unrelated field rejected: %v", err)
	}
}

func TestUseRcloneBinaryRecordsChoiceAndResets(t *testing.T) {
	state := newTestState(t, Config{})

	if err := state.UseRcloneBinary(settings.SourceManaged, ptr("/managed/rclone")); err != nil {
		t.Fatal(err)
	}
	doc := state.Settings.Get()
	if state.Rclone.Settings().Bin != "/managed/rclone" || doc.RcloneSource != settings.SourceManaged ||
		doc.RcloneBin == nil || *doc.RcloneBin != "/managed/rclone" {
		t.Fatalf("after select: bin=%q doc=%+v", state.Rclone.Settings().Bin, doc)
	}

	if err := state.UseRcloneBinary(settings.SourceSystem, nil); err != nil {
		t.Fatal(err)
	}
	doc = state.Settings.Get()
	if state.Rclone.Settings().Bin != "rclone" || doc.RcloneSource != settings.SourceSystem || doc.RcloneBin != nil {
		t.Fatalf("after reset: bin=%q doc=%+v", state.Rclone.Settings().Bin, doc)
	}
}

func TestCORSOriginsAddsOnlyNonLoopbackHost(t *testing.T) {
	loopback := CORSOrigins("127.0.0.1", 8080)
	for _, host := range []string{"localhost", "::1", "[::1]"} {
		if got := CORSOrigins(host, 8080); len(got) != len(loopback) {
			t.Errorf("CORSOrigins(%q) = %v, loopback hosts must not add an origin", host, got)
		}
	}
	got := CORSOrigins("192.168.1.10", 8080)
	if len(got) != len(loopback)+1 || got[len(got)-1] != "http://192.168.1.10:8080" {
		t.Fatalf("CORSOrigins(LAN) = %v", got)
	}
}
