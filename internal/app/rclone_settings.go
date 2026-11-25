package app

import (
	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/settings"
)

// rcloneSettingsFrom builds the supervisor's settings from the persisted
// document, then lets explicit CLI values win.
func rcloneSettingsFrom(doc settings.Document, cfg Config) rclone.Settings {
	out := rclone.DefaultSettings()
	if doc.RcloneBin != nil && *doc.RcloneBin != "" {
		out.Bin = *doc.RcloneBin
	}
	if doc.RcloneConfig != nil {
		out.Config = *doc.RcloneConfig
	}
	if doc.RcloneRCURL != nil {
		out.RCURL = *doc.RcloneRCURL
	}
	if cfg.RcloneURL != "" {
		out.RCURL = cfg.RcloneURL
	}
	if cfg.RcloneUser != "" {
		out.RCUser = cfg.RcloneUser
	}
	if cfg.RclonePass != "" {
		out.RCPass = cfg.RclonePass
	}
	if cfg.RcloneBin != "" {
		out.Bin = cfg.RcloneBin
	}
	if cfg.RcloneConfig != "" {
		out.Config = cfg.RcloneConfig
	}
	return out
}

// ApplySettings pushes a changed settings document into the running
// supervisor, skipping every field the CLI pinned for this process.
func (s *State) ApplySettings(doc settings.Document) {
	s.Rclone.UpdateSettings(func(out *rclone.Settings) {
		if !s.CLIBinOverride && doc.RcloneBin != nil {
			out.Bin = *doc.RcloneBin
		}
		if !s.CLIConfigOverride {
			out.Config = ""
			if doc.RcloneConfig != nil {
				out.Config = *doc.RcloneConfig
			}
		}
		if !s.CLIURLOverride {
			out.RCURL = ""
			if doc.RcloneRCURL != nil {
				out.RCURL = *doc.RcloneRCURL
			}
		}
	})
}

// UseRcloneBinary selects the rclone executable at path and records the
// choice. A nil path resets to the system "rclone" and clears the stored path.
func (s *State) UseRcloneBinary(source settings.SourceKind, path *string) error {
	bin := "rclone"
	if path != nil {
		bin = *path
	}
	s.Rclone.UpdateSettings(func(out *rclone.Settings) { out.Bin = bin })
	_, err := s.Settings.Patch(settings.Patch{
		RcloneSource: &source,
		RcloneBin:    settings.Nullable[string]{Set: true, Value: path},
	})
	return err
}

// CheckSettingsPatch rejects a settings patch that touches a field pinned by a
// CLI flag for the lifetime of this process.
func (s *State) CheckSettingsPatch(patch settings.Patch) error {
	pinned := []struct {
		overridden bool
		touched    bool
		what       string
	}{
		{s.CLIBinOverride, patch.RcloneBin.Set, "rclone binary"},
		{s.CLIConfigOverride, patch.RcloneConfig.Set, "rclone config"},
		{s.CLIURLOverride, patch.RcloneRCURL.Set, "rclone RC endpoint"},
	}
	for _, p := range pinned {
		if p.overridden && p.touched {
			return core.ConflictDetail(p.what+" is overridden by CLI for this process", map[string]any{"kind": "cli_override"})
		}
	}
	return nil
}
