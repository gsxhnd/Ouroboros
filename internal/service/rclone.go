package service

import (
	"context"
	"os"
	"path/filepath"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/settings"
)

type RcloneSelection struct {
	Source  rclone.SourceKind `json:"source"`
	Path    *string           `json:"path"`
	Version *string           `json:"version"`
}

type RcloneReleases struct {
	Current  string           `json:"current"`
	Releases []rclone.Release `json:"releases"`
}

type RcloneRuntime struct{ serviceBase }

func (s *RcloneRuntime) Status() rclone.Status {
	return s.state.Rclone.Status()
}

func (s *RcloneRuntime) EnsureRunning(ctx context.Context) (rclone.Status, error) {
	return s.state.Rclone.EnsureRunning(ctx)
}

func (s *RcloneRuntime) Stop(ctx context.Context) (rclone.Status, error) {
	return s.state.Rclone.Stop(ctx)
}

func (s *RcloneRuntime) Scan(ctx context.Context) []rclone.Candidate {
	doc := s.state.Settings.Get()
	custom := ""
	if doc.RcloneBin != nil {
		path := *doc.RcloneBin
		if filepath.IsAbs(path) || fileExists(path) {
			custom = path
		}
	}
	return rclone.Scan(ctx, custom, s.state.VersionsDir())
}

func (s *RcloneRuntime) Select(selection RcloneSelection) (rclone.Status, error) {
	var path string
	switch selection.Source {
	case rclone.SourceManaged:
		if selection.Version == nil || *selection.Version == "" {
			return rclone.Status{}, invalidRequest("managed source requires version")
		}
		version, err := rclone.SafeVersion(*selection.Version)
		if err != nil {
			return rclone.Status{}, err
		}
		path = rclone.ManagedBinaryPath(s.state.VersionsDir(), version)
	default:
		if selection.Path == nil || *selection.Path == "" {
			return rclone.Status{}, invalidRequest("source requires an executable path")
		}
		path = *selection.Path
	}
	if _, err := os.Stat(path); err != nil {
		return rclone.Status{}, core.BinaryNotFound(path)
	}
	if err := s.state.UseRcloneBinary(settings.SourceKind(selection.Source), &path); err != nil {
		return rclone.Status{}, err
	}
	return s.state.Rclone.Status(), nil
}

func (s *RcloneRuntime) Releases(ctx context.Context) (RcloneReleases, error) {
	current, err := rclone.CurrentRelease(ctx, s.state.Rclone.Client())
	if err != nil {
		return RcloneReleases{}, err
	}
	release, err := rclone.ReleaseForPlatform(current.Version)
	if err != nil {
		return RcloneReleases{}, err
	}
	return RcloneReleases{Current: current.Version, Releases: []rclone.Release{release}}, nil
}

func (s *RcloneRuntime) DownloadStart(version string) (rclone.DownloadSnapshot, error) {
	return s.state.Downloads.Start(s.state.Context(), version, s.state.VersionsDir(), func(snapshot rclone.DownloadSnapshot) {
		s.state.Events.Publish(events.NameDownload, snapshot)
	})
}

func (s *RcloneRuntime) DownloadCancel(id string) (rclone.DownloadSnapshot, error) {
	return s.state.Downloads.Cancel(id)
}

func (s *RcloneRuntime) Activate(version string) (rclone.Status, error) {
	version, err := rclone.SafeVersion(version)
	if err != nil {
		return rclone.Status{}, err
	}
	path := rclone.ManagedBinaryPath(s.state.VersionsDir(), version)
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return rclone.Status{}, core.NotFound("managed rclone " + version)
	}
	if err := s.state.UseRcloneBinary(settings.SourceManaged, &path); err != nil {
		return rclone.Status{}, err
	}
	return s.state.Rclone.Status(), nil
}

func (s *RcloneRuntime) DeleteVersion(version string) error {
	version, err := rclone.SafeVersion(version)
	if err != nil {
		return err
	}
	dir := filepath.Join(s.state.VersionsDir(), version)
	if _, err := os.Stat(dir); err != nil {
		return core.NotFound("managed rclone " + version)
	}
	current := s.state.Rclone.SelectedBin()
	managed := rclone.ManagedBinaryPath(s.state.VersionsDir(), version)
	if err := os.RemoveAll(dir); err != nil {
		return core.IO(err)
	}
	if filepath.Clean(current) == filepath.Clean(managed) {
		if err := s.state.UseRcloneBinary(settings.SourceSystem, nil); err != nil {
			return err
		}
	}
	return nil
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
