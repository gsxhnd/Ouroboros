package cli

import (
	"strings"
	"testing"

	"github.com/gsxhnd/ourboros/internal/persist"
)

func clearEnv(t *testing.T) {
	t.Helper()
	for _, name := range []string{
		"OURBOROS_WEB_DIR", "OURBOROS_DATA_DIR", "OURBOROS_TOKEN", "OURBOROS_HISTORY_DB", "OURBOROS_LOG_DIR",
		"RCLONE_BIN", "RCLONE_RC_URL", "RCLONE_RC_USER", "RCLONE_RC_PASS", "RCLONE_CONFIG",
	} {
		t.Setenv(name, "")
	}
}

func parse(t *testing.T, args ...string) ServerArgs {
	t.Helper()
	clearEnv(t)
	got, err := ParseServerArgs(args)
	if err != nil {
		t.Fatalf("ParseServerArgs(%v): %v", args, err)
	}
	return got
}

func TestParseServerArgsDefaults(t *testing.T) {
	got := parse(t)
	if got.Host != "127.0.0.1" || got.Port != 8080 || got.WebDirExplicit || got.NoAutoRclone {
		t.Fatalf("defaults = %+v", got)
	}
}

// Every value flag accepts both "--flag value" and "--flag=value".
func TestParseServerArgsValueFlagsAcceptBothForms(t *testing.T) {
	cases := []struct {
		flag string
		get  func(ServerArgs) string
	}{
		{"--host", func(a ServerArgs) string { return a.Host }},
		{"--data-dir", func(a ServerArgs) string { return a.DataDir }},
		{"--auth-token", func(a ServerArgs) string { return a.AuthToken }},
		{"--history-db", func(a ServerArgs) string { return a.HistoryDB }},
		{"--log-dir", func(a ServerArgs) string { return a.LogDir }},
		{"--rclone-bin", func(a ServerArgs) string { return a.RcloneBin }},
		{"--rclone-url", func(a ServerArgs) string { return a.RcloneURL }},
		{"--rclone-user", func(a ServerArgs) string { return a.RcloneUser }},
		{"--rclone-pass", func(a ServerArgs) string { return a.RclonePass }},
		{"--rclone-config", func(a ServerArgs) string { return a.RcloneConfig }},
		{"--webui", func(a ServerArgs) string { return a.WebDir }},
		{"--web-dir", func(a ServerArgs) string { return a.WebDir }},
	}
	for _, tc := range cases {
		if got := tc.get(parse(t, tc.flag, "spaced")); got != "spaced" {
			t.Errorf("%s spaced: got %q", tc.flag, got)
		}
		if got := tc.get(parse(t, tc.flag+"=joined")); got != "joined" {
			t.Errorf("%s=joined: got %q", tc.flag, got)
		}
	}
}

func TestParseServerArgsEqualsValueMayContainEquals(t *testing.T) {
	if got := parse(t, "--auth-token=a=b=c").AuthToken; got != "a=b=c" {
		t.Fatalf("token = %q", got)
	}
}

func TestParseServerArgsEmptyEqualsValueIsAccepted(t *testing.T) {
	if got := parse(t, "--rclone-bin=").RcloneBin; got != "" {
		t.Fatalf("bin = %q", got)
	}
}

func TestParseServerArgsPort(t *testing.T) {
	for _, args := range [][]string{{"--port", "9000"}, {"--port=9000"}, {"-p", "9000"}} {
		if got := parse(t, args...).Port; got != 9000 {
			t.Errorf("%v: port = %d", args, got)
		}
	}
	if got := parse(t, "--port", "0").Port; got != 0 {
		t.Errorf("port 0 (any free port) = %d", got)
	}
	for _, bad := range []string{"abc", "-1", "65536", "", "80.5"} {
		clearEnv(t)
		if _, err := ParseServerArgs([]string{"--port", bad}); err == nil || !strings.Contains(err.Error(), "invalid port") {
			t.Errorf("--port %q: err = %v", bad, err)
		}
		if _, err := ParseServerArgs([]string{"--port=" + bad}); err == nil || !strings.Contains(err.Error(), "invalid port") {
			t.Errorf("--port=%q: err = %v", bad, err)
		}
	}
}

func TestParseServerArgsWebDirIsExplicitOnlyWhenGiven(t *testing.T) {
	if parse(t).WebDirExplicit {
		t.Fatal("no flag and no env must not be explicit")
	}
	if !parse(t, "--webui", "/ui").WebDirExplicit || !parse(t, "--web-dir=/ui").WebDirExplicit {
		t.Fatal("a web dir flag must be explicit")
	}
	clearEnv(t)
	t.Setenv("OURBOROS_WEB_DIR", "/from/env")
	got, err := ParseServerArgs(nil)
	if err != nil || got.WebDir != "/from/env" || !got.WebDirExplicit {
		t.Fatalf("env web dir: (%+v, %v)", got, err)
	}
}

func TestParseServerArgsFlagBeatsEnv(t *testing.T) {
	clearEnv(t)
	t.Setenv("RCLONE_BIN", "/env/rclone")
	t.Setenv("OURBOROS_TOKEN", "env-token")
	got, err := ParseServerArgs([]string{"--rclone-bin", "/flag/rclone"})
	if err != nil {
		t.Fatal(err)
	}
	if got.RcloneBin != "/flag/rclone" || got.AuthToken != "env-token" {
		t.Fatalf("got bin=%q token=%q", got.RcloneBin, got.AuthToken)
	}
}

func TestParseServerArgsEnvFillsEveryField(t *testing.T) {
	clearEnv(t)
	for k, v := range map[string]string{
		"OURBOROS_DATA_DIR": "/d", "OURBOROS_TOKEN": "t", "OURBOROS_HISTORY_DB": "/h/history.db", "OURBOROS_LOG_DIR": "/l", "RCLONE_BIN": "/b",
		"RCLONE_RC_URL": "http://127.0.0.1:1", "RCLONE_RC_USER": "u", "RCLONE_RC_PASS": "p", "RCLONE_CONFIG": "/c",
	} {
		t.Setenv(k, v)
	}
	got, err := ParseServerArgs(nil)
	if err != nil {
		t.Fatal(err)
	}
	want := ServerArgs{
		Host: "127.0.0.1", Port: 8080, DataDir: "/d", AuthToken: "t", HistoryDB: "/h/history.db", LogDir: "/l", RcloneBin: "/b",
		RcloneURL: "http://127.0.0.1:1", RcloneUser: "u", RclonePass: "p", RcloneConfig: "/c",
	}
	if got != want {
		t.Fatalf("got %+v\nwant %+v", got, want)
	}
}

// 历史库与日志默认跟随数据目录；显式路径覆盖默认值。
func TestParseServerArgsHistoryDBAndLogDirFollowDataDir(t *testing.T) {
	// 默认为空，运行时解析为 <data-dir>/ourboros.db 与 <data-dir>/log。
	got := parse(t)
	if got.HistoryDB != "" || got.LogDir != "" {
		t.Fatalf("defaults should be empty (follow data dir): %+v", got)
	}
	if got.DataDir != persist.DefaultDataDir() {
		t.Fatalf("data dir should resolve to its default, got %q", got.DataDir)
	}
	if got := parse(t, "--history-db", "/tmp/x.db").HistoryDB; got != "/tmp/x.db" {
		t.Fatalf("history db flag = %q", got)
	}
	if got := parse(t, "--log-dir", "/tmp/logs").LogDir; got != "/tmp/logs" {
		t.Fatalf("log dir flag = %q", got)
	}
}

// --data-dir 指定时，历史库与日志都跟随它（运行时解析），CLI 本身保持空。
func TestParseServerArgsDataDirExplicit(t *testing.T) {
	got := parse(t, "--data-dir", "/srv/ourboros")
	if got.DataDir != "/srv/ourboros" {
		t.Fatalf("data dir = %q", got.DataDir)
	}
	if got.HistoryDB != "" || got.LogDir != "" {
		t.Fatalf("history/log should follow data dir: %+v", got)
	}
}

func TestParseServerArgsBoolAndHelp(t *testing.T) {
	if !parse(t, "--no-auto-rclone").NoAutoRclone {
		t.Fatal("--no-auto-rclone not set")
	}
	clearEnv(t)
	for _, flag := range []string{"--help", "-h"} {
		if _, err := ParseServerArgs([]string{flag}); !IsHelp(err) {
			t.Errorf("%s: err = %v, want help", flag, err)
		}
	}
}

func TestParseServerArgsErrors(t *testing.T) {
	clearEnv(t)
	for _, flag := range []string{"--host", "--port", "-p", "--data-dir", "--auth-token", "--history-db", "--log-dir", "--rclone-bin", "--rclone-url", "--rclone-user", "--rclone-pass", "--rclone-config", "--webui", "--web-dir"} {
		if _, err := ParseServerArgs([]string{flag}); err == nil || !strings.Contains(err.Error(), "requires a value") {
			t.Errorf("%s with no value: err = %v", flag, err)
		}
	}
	if _, err := ParseServerArgs([]string{"--bogus"}); err == nil || !strings.Contains(err.Error(), `unknown flag "--bogus"`) {
		t.Errorf("unknown flag: err = %v", err)
	}
	if _, err := ParseServerArgs([]string{"--no-auto-rclone=yes"}); err == nil {
		t.Error("a boolean flag must not take a value")
	}
}

func TestParseServerArgsLaterFlagWins(t *testing.T) {
	if got := parse(t, "--host", "a", "--host=b").Host; got != "b" {
		t.Fatalf("host = %q", got)
	}
}
