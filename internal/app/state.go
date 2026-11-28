package app

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/history"
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
	History           *history.Store
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
	// 执行历史是增强功能：数据库打不开（例如目录不可写）只降级为
	// 无历史记录，服务照常启动。默认与 workspace/settings 同住数据目录。
	historyPath := cfg.HistoryPath
	if historyPath == "" {
		historyPath = filepath.Join(dataDir, "ourboros.db")
	}
	hist, err := openHistoryDB(historyPath)
	if err != nil {
		slog.Warn("sync run history is disabled", "path", historyPath, "err", err)
		hist = nil
	}
	jobStore := jobs.New(ctx, bus, supervisor, recordJobStart(hist), recordJobResult(workspaceStore, hist))
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
		History:           hist,
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

// openHistoryDB 创建父目录后打开 bbolt 数据库；bbolt 只建文件不建父目录，
// 默认布局 <data-dir>/ourboros.db 依赖这里补齐父目录。
func openHistoryDB(path string) (*history.Store, error) {
	if dir := filepath.Dir(path); dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, err
		}
	}
	return history.Open(path)
}

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
	if s.History != nil {
		_ = s.History.Close()
	}
}
