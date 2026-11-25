package app

import (
	"context"
	"os"
	"path/filepath"
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

type State struct {
	Version string
	HomeDir string
	DataDir string
	Origins []string
	// AuthToken enables the bearer-token gate on /api when non-empty; empty
	// means loopback-only mode without authentication (desktop / local dev).
	AuthToken         string
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
	workspacePath := doc.ResolveWorkspacePath(dataDir)
	home, _ := os.UserHomeDir()
	workspaceStore, err := workspace.LoadOrCreate(workspacePath, home)
	if err != nil {
		return nil, err
	}

	rcloneSettings := rcloneSettingsFrom(doc, cfg)

	bus := events.New()
	supervisor := rclone.NewSupervisor(rcloneSettings)
	jobStore := jobs.New(ctx, bus, supervisor, recordJobResult(workspaceStore))
	return &State{
		Version:           version.Version,
		HomeDir:           home,
		DataDir:           dataDir,
		Origins:           CORSOrigins(cfg.BindHost, cfg.BindPort),
		AuthToken:         cfg.AuthToken,
		Rclone:            supervisor,
		Workspace:         workspaceStore,
		Settings:          settingsStore,
		Jobs:              jobStore,
		Mounts:            mounts.New(bus, supervisor, workspaceStore),
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
