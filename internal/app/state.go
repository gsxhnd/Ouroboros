package app

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/jobs"
	"github.com/gsxhnd/ourboros/internal/mounts"
	"github.com/gsxhnd/ourboros/internal/persist"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/settings"
	"github.com/gsxhnd/ourboros/internal/version"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

type Config struct {
	DataDir      string
	BindHost     string
	BindPort     int
	RcloneBin    string
	RcloneURL    string
	RcloneConfig string
	RcloneUser   string
	RclonePass   string
	NoAutoRclone bool
}

func (c Config) withDefaults() Config {
	if c.BindHost == "" {
		c.BindHost = "127.0.0.1"
	}
	if c.BindPort == 0 {
		c.BindPort = 8080
	}
	return c
}

type State struct {
	Version           string
	HomeDir           string
	DataDir           string
	Origins           []string
	Rclone            *rclone.Supervisor
	Workspace         *workspace.Store
	Settings          *settings.Store
	Jobs              *jobs.Store
	Mounts            *mounts.Supervisor
	Downloads         *rclone.DownloadManager
	Events            *events.Bus
	CLIBinOverride    bool
	CLIConfigOverride bool
	CLIURLOverride    bool
	ctx               context.Context
}

func New(ctx context.Context, cfg Config) (*State, error) {
	cfg = cfg.withDefaults()
	if ctx == nil {
		ctx = context.Background()
	}
	dataDir := cfg.DataDir
	if dataDir == "" {
		dataDir = persist.DefaultDataDir()
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	settingsStore, err := settings.LoadOrCreate(filepath.Join(dataDir, "settings.json"))
	if err != nil {
		return nil, err
	}
	doc := settingsStore.Get()
	workspacePath := filepath.Join(dataDir, "workspace.json")
	if doc.WorkspacePath != nil && *doc.WorkspacePath != "" {
		if filepath.IsAbs(*doc.WorkspacePath) {
			workspacePath = *doc.WorkspacePath
		} else {
			workspacePath = filepath.Join(dataDir, *doc.WorkspacePath)
		}
	}
	home, _ := os.UserHomeDir()
	workspaceStore, err := workspace.LoadOrCreate(workspacePath, home)
	if err != nil {
		return nil, err
	}

	rcloneSettings := rclone.DefaultSettings()
	settings.ApplyToRclone(doc, &rcloneSettings)
	if cfg.RcloneURL != "" {
		rcloneSettings.RCURL = cfg.RcloneURL
	}
	if cfg.RcloneUser != "" {
		rcloneSettings.RCUser = cfg.RcloneUser
	}
	if cfg.RclonePass != "" {
		rcloneSettings.RCPass = cfg.RclonePass
	}
	if cfg.RcloneBin != "" {
		rcloneSettings.Bin = cfg.RcloneBin
	}
	if cfg.RcloneConfig != "" {
		rcloneSettings.Config = cfg.RcloneConfig
	}

	bus := events.New()
	supervisor := rclone.NewSupervisor(rcloneSettings)
	return &State{
		Version:           version.Version,
		HomeDir:           home,
		DataDir:           dataDir,
		Origins:           CORSOrigins(cfg.BindHost, cfg.BindPort),
		Rclone:            supervisor,
		Workspace:         workspaceStore,
		Settings:          settingsStore,
		Jobs:              jobs.New(ctx, bus),
		Mounts:            mounts.New(bus),
		Downloads:         rclone.NewDownloadManager(supervisor.Client()),
		Events:            bus,
		CLIBinOverride:    cfg.RcloneBin != "",
		CLIConfigOverride: cfg.RcloneConfig != "",
		CLIURLOverride:    cfg.RcloneURL != "",
		ctx:               ctx,
	}, nil
}

func (s *State) Context() context.Context { return s.ctx }

func (s *State) VersionsDir() string {
	return filepath.Join(s.DataDir, "rclone", "versions")
}

// Close unmounts active mounts, then stops the managed rclone process.
func (s *State) Close() {
	if s == nil {
		return
	}
	if s.Mounts != nil {
		s.Mounts.StopAll()
	}
	if s.Rclone != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_, _ = s.Rclone.Stop(ctx)
	}
}

func CORSOrigins(host string, port int) []string {
	origins := []string{
		"http://127.0.0.1:1420",
		"http://localhost:1420",
		origin("127.0.0.1", port),
		origin("localhost", port),
	}
	if host != "127.0.0.1" && host != "localhost" && host != "::1" {
		origins = append(origins, origin(host, port))
	}
	return origins
}

func origin(host string, port int) string {
	return "http://" + host + ":" + strconv.Itoa(port)
}
