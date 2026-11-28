package cli

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/gsxhnd/ourboros/internal/netutil"
	"github.com/gsxhnd/ourboros/internal/persist"
)

type Command struct {
	Name   string
	Server ServerArgs
}

type ServerArgs struct {
	Host           string
	Port           int
	WebDir         string
	WebDirExplicit bool
	DataDir        string
	AuthToken      string
	// HistoryDB 是同步执行历史的 bbolt 文件路径；空表示数据目录下的 ourboros.db。
	HistoryDB string
	// LogDir 是进程日志目录；空表示数据目录下的 log 文件夹。
	LogDir       string
	RcloneBin    string
	RcloneURL    string
	RcloneUser   string
	RclonePass   string
	RcloneConfig string
	NoAutoRclone bool
}

func Parse(args []string) (Command, error) {
	if len(args) == 0 {
		return Command{Name: "help"}, nil
	}
	switch args[0] {
	case "help", "--help", "-h":
		return Command{Name: "help"}, nil
	case "version", "--version", "-V":
		return Command{Name: "version"}, nil
	case "server":
		server, err := ParseServerArgs(args[1:])
		if err != nil {
			return Command{}, err
		}
		return Command{Name: "server", Server: server}, nil
	case "desktop":
		server, err := ParseServerArgs(args[1:])
		if err != nil {
			return Command{}, err
		}
		return Command{Name: "desktop", Server: server}, nil
	default:
		if strings.HasPrefix(args[0], "-") {
			server, err := ParseServerArgs(args)
			if err != nil {
				return Command{}, err
			}
			return Command{Name: "server", Server: server}, nil
		}
		return Command{}, fmt.Errorf("unknown command %q", args[0])
	}
}

// valueFlags lists every flag that takes a value. Each accepts "--flag value"
// and "--flag=value"; set stores the value into the parsed arguments.
var valueFlags = []struct {
	names []string
	set   func(*ServerArgs, string) error
}{
	{[]string{"--host"}, func(a *ServerArgs, v string) error { a.Host = v; return nil }},
	{[]string{"--port", "-p"}, func(a *ServerArgs, v string) error {
		port, err := strconv.Atoi(v)
		if err != nil || port < 0 || port > 65535 {
			return fmt.Errorf("invalid port %q", v)
		}
		a.Port = port
		return nil
	}},
	{[]string{"--webui", "--web-dir"}, func(a *ServerArgs, v string) error {
		a.WebDir, a.WebDirExplicit = v, true
		return nil
	}},
	{[]string{"--data-dir"}, func(a *ServerArgs, v string) error { a.DataDir = v; return nil }},
	{[]string{"--auth-token"}, func(a *ServerArgs, v string) error { a.AuthToken = v; return nil }},
	{[]string{"--history-db"}, func(a *ServerArgs, v string) error { a.HistoryDB = v; return nil }},
	{[]string{"--log-dir"}, func(a *ServerArgs, v string) error { a.LogDir = v; return nil }},
	{[]string{"--rclone-bin"}, func(a *ServerArgs, v string) error { a.RcloneBin = v; return nil }},
	{[]string{"--rclone-url"}, func(a *ServerArgs, v string) error { a.RcloneURL = v; return nil }},
	{[]string{"--rclone-user"}, func(a *ServerArgs, v string) error { a.RcloneUser = v; return nil }},
	{[]string{"--rclone-pass"}, func(a *ServerArgs, v string) error { a.RclonePass = v; return nil }},
	{[]string{"--rclone-config"}, func(a *ServerArgs, v string) error { a.RcloneConfig = v; return nil }},
}

func ParseServerArgs(args []string) (ServerArgs, error) {
	parsed := ServerArgs{
		Host:         "127.0.0.1",
		Port:         8080,
		WebDir:       os.Getenv("OURBOROS_WEB_DIR"),
		DataDir:      os.Getenv("OURBOROS_DATA_DIR"),
		AuthToken:    os.Getenv("OURBOROS_TOKEN"),
		RcloneBin:    os.Getenv("RCLONE_BIN"),
		RcloneURL:    os.Getenv("RCLONE_RC_URL"),
		RcloneUser:   os.Getenv("RCLONE_RC_USER"),
		RclonePass:   os.Getenv("RCLONE_RC_PASS"),
		RcloneConfig: os.Getenv("RCLONE_CONFIG"),
	}
	if env := os.Getenv("OURBOROS_HISTORY_DB"); env != "" {
		parsed.HistoryDB = env
	}
	if env := os.Getenv("OURBOROS_LOG_DIR"); env != "" {
		parsed.LogDir = env
	}
	if parsed.WebDir != "" {
		parsed.WebDirExplicit = true
	}
	for i := 0; i < len(args); i++ {
		arg := args[i]
		switch arg {
		case "--help", "-h":
			return ServerArgs{}, errHelp
		case "--no-auto-rclone":
			parsed.NoAutoRclone = true
			continue
		}
		name, inline, hasInline := strings.Cut(arg, "=")
		flag := findValueFlag(name)
		if flag == nil {
			return ServerArgs{}, fmt.Errorf("unknown flag %q", arg)
		}
		value := inline
		if !hasInline {
			var err error
			if value, err = takeValue(args, &i, name); err != nil {
				return ServerArgs{}, err
			}
		}
		if err := flag.set(&parsed, value); err != nil {
			return ServerArgs{}, err
		}
	}
	// 数据目录在此定死，供运行时布局（workspace/settings/历史库/日志）统一解析。
	if parsed.DataDir == "" {
		parsed.DataDir = persist.DefaultDataDir()
	}
	return parsed, nil
}

func findValueFlag(name string) *struct {
	names []string
	set   func(*ServerArgs, string) error
} {
	for i := range valueFlags {
		for _, candidate := range valueFlags[i].names {
			if candidate == name {
				return &valueFlags[i]
			}
		}
	}
	return nil
}

var errHelp = fmt.Errorf("help")

func IsHelp(err error) bool { return err == errHelp }

func takeValue(args []string, i *int, flag string) (string, error) {
	if *i+1 >= len(args) {
		return "", fmt.Errorf("%s requires a value", flag)
	}
	*i++
	return args[*i], nil
}

// AssertBindHost enforces the security posture: loopback binds need no
// authentication; anything wider (Docker, NAS, LAN) requires an access token
// so every /api request must present it. TLS and full-origin hardening remain
// prerequisites for multi-user exposure.
func AssertBindHost(host, authToken string) error {
	if netutil.IsLoopbackHost(host) {
		return nil
	}
	if authToken == "" {
		return fmt.Errorf("refusing to bind %s without an access token: pass --auth-token (env OURBOROS_TOKEN) or use 127.0.0.1", host)
	}
	return nil
}

func Help() string {
	return `Ourboros is a web UI for rclone.

Usage:
  ourboros server [flags]
  ourboros version

Flags:
  --host ADDR          Bind address (default 127.0.0.1; non-loopback requires --auth-token)
  --port, -p PORT      Bind port (default 8080)
  --webui, --web-dir   Directory containing index.html (env OURBOROS_WEB_DIR)
  --data-dir DIR       Workspace, settings, run history and logs directory (env OURBOROS_DATA_DIR)
  --auth-token TOKEN   Require a bearer token on /api (env OURBOROS_TOKEN); needed when binding non-loopback (Docker)
  --history-db PATH    Sync run history database file (default <data-dir>/ourboros.db; env OURBOROS_HISTORY_DB)
  --log-dir DIR        Process log directory (default <data-dir>/log; env OURBOROS_LOG_DIR)
  --rclone-bin PATH    rclone executable (env RCLONE_BIN)
  --rclone-url URL     Attach to an existing RC URL (env RCLONE_RC_URL)
  --rclone-user USER   RC username when attaching (env RCLONE_RC_USER)
  --rclone-pass PASS   RC password when attaching (env RCLONE_RC_PASS)
  --rclone-config PATH rclone.conf path (env RCLONE_CONFIG)
  --no-auto-rclone     Do not start or attach to rclone automatically
`
}
