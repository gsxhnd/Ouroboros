package cli

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/gsxhnd/ourboros/internal/app"
	"github.com/gsxhnd/ourboros/internal/rclone"
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
	RcloneBin      string
	RcloneURL      string
	RcloneUser     string
	RclonePass     string
	RcloneConfig   string
	NoAutoRclone   bool
}

func (a ServerArgs) Runtime() app.Config {
	return app.Config{
		DataDir:      a.DataDir,
		BindHost:     a.Host,
		BindPort:     a.Port,
		RcloneBin:    a.RcloneBin,
		RcloneURL:    a.RcloneURL,
		RcloneConfig: a.RcloneConfig,
		RcloneUser:   a.RcloneUser,
		RclonePass:   a.RclonePass,
		NoAutoRclone: a.NoAutoRclone,
	}
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

func ParseServerArgs(args []string) (ServerArgs, error) {
	parsed := ServerArgs{
		Host:         "127.0.0.1",
		Port:         8080,
		WebDir:       os.Getenv("OURBOROS_WEB_DIR"),
		DataDir:      os.Getenv("OURBOROS_DATA_DIR"),
		RcloneBin:    os.Getenv("RCLONE_BIN"),
		RcloneURL:    os.Getenv("RCLONE_RC_URL"),
		RcloneUser:   os.Getenv("RCLONE_RC_USER"),
		RclonePass:   os.Getenv("RCLONE_RC_PASS"),
		RcloneConfig: os.Getenv("RCLONE_CONFIG"),
	}
	if parsed.WebDir != "" {
		parsed.WebDirExplicit = true
	}
	for i := 0; i < len(args); i++ {
		arg := args[i]
		switch {
		case arg == "--help" || arg == "-h":
			return ServerArgs{}, errHelp
		case arg == "--host":
			value, err := takeValue(args, &i, arg)
			if err != nil {
				return ServerArgs{}, err
			}
			parsed.Host = value
		case strings.HasPrefix(arg, "--host="):
			parsed.Host = strings.TrimPrefix(arg, "--host=")
		case arg == "--port" || arg == "-p":
			value, err := takeValue(args, &i, arg)
			if err != nil {
				return ServerArgs{}, err
			}
			port, err := strconv.Atoi(value)
			if err != nil || port < 0 || port > 65535 {
				return ServerArgs{}, fmt.Errorf("invalid port %q", value)
			}
			parsed.Port = port
		case strings.HasPrefix(arg, "--port="):
			port, err := strconv.Atoi(strings.TrimPrefix(arg, "--port="))
			if err != nil || port < 0 || port > 65535 {
				return ServerArgs{}, fmt.Errorf("invalid port %q", strings.TrimPrefix(arg, "--port="))
			}
			parsed.Port = port
		case arg == "--webui" || arg == "--web-dir":
			value, err := takeValue(args, &i, arg)
			if err != nil {
				return ServerArgs{}, err
			}
			parsed.WebDir = value
			parsed.WebDirExplicit = true
		case strings.HasPrefix(arg, "--webui=") || strings.HasPrefix(arg, "--web-dir="):
			parsed.WebDir = strings.SplitN(arg, "=", 2)[1]
			parsed.WebDirExplicit = true
		case arg == "--data-dir":
			value, err := takeValue(args, &i, arg)
			if err != nil {
				return ServerArgs{}, err
			}
			parsed.DataDir = value
		case strings.HasPrefix(arg, "--data-dir="):
			parsed.DataDir = strings.TrimPrefix(arg, "--data-dir=")
		case arg == "--rclone-bin":
			value, err := takeValue(args, &i, arg)
			if err != nil {
				return ServerArgs{}, err
			}
			parsed.RcloneBin = value
		case strings.HasPrefix(arg, "--rclone-bin="):
			parsed.RcloneBin = strings.TrimPrefix(arg, "--rclone-bin=")
		case arg == "--rclone-url":
			value, err := takeValue(args, &i, arg)
			if err != nil {
				return ServerArgs{}, err
			}
			parsed.RcloneURL = value
		case strings.HasPrefix(arg, "--rclone-url="):
			parsed.RcloneURL = strings.TrimPrefix(arg, "--rclone-url=")
		case arg == "--rclone-user":
			value, err := takeValue(args, &i, arg)
			if err != nil {
				return ServerArgs{}, err
			}
			parsed.RcloneUser = value
		case arg == "--rclone-pass":
			value, err := takeValue(args, &i, arg)
			if err != nil {
				return ServerArgs{}, err
			}
			parsed.RclonePass = value
		case arg == "--rclone-config":
			value, err := takeValue(args, &i, arg)
			if err != nil {
				return ServerArgs{}, err
			}
			parsed.RcloneConfig = value
		case strings.HasPrefix(arg, "--rclone-config="):
			parsed.RcloneConfig = strings.TrimPrefix(arg, "--rclone-config=")
		case arg == "--no-auto-rclone":
			parsed.NoAutoRclone = true
		default:
			return ServerArgs{}, fmt.Errorf("unknown flag %q", arg)
		}
	}
	return parsed, nil
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

func AssertBindHost(host string) error {
	if rclone.IsLoopbackHost(host) {
		return nil
	}
	return fmt.Errorf("refusing to bind %s: HTTP authentication is not implemented; use 127.0.0.1", host)
}

func Help() string {
	return `Ourboros is a web UI for rclone.

Usage:
  ourboros server [flags]
  ourboros version

Flags:
  --host ADDR          Bind address (default 127.0.0.1)
  --port, -p PORT      Bind port (default 8080)
  --webui, --web-dir   Directory containing index.html (env OURBOROS_WEB_DIR)
  --data-dir DIR       Workspace and settings directory (env OURBOROS_DATA_DIR)
  --rclone-bin PATH    rclone executable (env RCLONE_BIN)
  --rclone-url URL     Attach to an existing RC URL (env RCLONE_RC_URL)
  --rclone-user USER   RC username when attaching (env RCLONE_RC_USER)
  --rclone-pass PASS   RC password when attaching (env RCLONE_RC_PASS)
  --rclone-config PATH rclone.conf path (env RCLONE_CONFIG)
  --no-auto-rclone     Do not start or attach to rclone automatically
`
}
