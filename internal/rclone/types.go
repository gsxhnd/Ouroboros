package rclone

import "github.com/gsxhnd/ourboros/internal/paths"

type Mode string

const (
	ModeSpawned  Mode = "spawned"
	ModeAttached Mode = "attached"
)

type Status struct {
	Running   bool    `json:"running"`
	Mode      *Mode   `json:"mode"`
	Version   *string `json:"version"`
	Binary    string  `json:"binary"`
	Endpoint  *string `json:"endpoint,omitempty"`
	Config    *string `json:"config,omitempty"`
	OS        *string `json:"os,omitempty"`
	Arch      *string `json:"arch,omitempty"`
	OSVersion *string `json:"os_version,omitempty"`
	GoVersion *string `json:"go_version,omitempty"`
	Linking   *string `json:"linking,omitempty"`
	Beta      *bool   `json:"beta,omitempty"`
}

type Settings struct {
	Bin    string
	RCURL  string
	RCUser string
	RCPass string
	Config string
}

func DefaultSettings() Settings {
	return Settings{Bin: "rclone"}
}

type Response struct {
	Status int
	Body   map[string]any
}

func (r Response) OK() bool { return r.Status >= 200 && r.Status < 300 }

type SourceKind string

const (
	SourceCustom  SourceKind = "custom"
	SourceManaged SourceKind = "managed"
	SourceSystem  SourceKind = "system"
)

type Candidate struct {
	Source  SourceKind `json:"source"`
	Path    string     `json:"path"`
	Version *string    `json:"version"`
	Valid   bool       `json:"valid"`
	Managed bool       `json:"managed"`
	Error   *string    `json:"error"`
}

type Release struct {
	Version  string `json:"version"`
	Filename string `json:"filename"`
	URL      string `json:"url"`
}

type DownloadStatus string

const (
	DownloadQueued      DownloadStatus = "queued"
	DownloadDownloading DownloadStatus = "downloading"
	DownloadVerifying   DownloadStatus = "verifying"
	DownloadExtracting  DownloadStatus = "extracting"
	DownloadCompleted   DownloadStatus = "completed"
	DownloadFailed      DownloadStatus = "failed"
	DownloadCancelled   DownloadStatus = "cancelled"
)

type DownloadSnapshot struct {
	ID         string         `json:"id"`
	Version    string         `json:"version"`
	Status     DownloadStatus `json:"status"`
	Bytes      uint64         `json:"bytes"`
	TotalBytes *uint64        `json:"total_bytes"`
	Error      *string        `json:"error,omitempty"`
}

type Auth struct {
	User string
	Pass string
}

type VersionInfo struct {
	Version   string `json:"version"`
	OS        string `json:"os"`
	Arch      string `json:"arch"`
	OSVersion string `json:"osVersion"`
	GoVersion string `json:"goVersion"`
	Linking   string `json:"linking"`
	IsBeta    bool   `json:"isBeta"`
}

func locatorFromParts(fs string, remote, path *string, home string) (paths.Locator, error) {
	var relative string
	var err error
	switch {
	case remote != nil && path != nil && *remote != *path:
		relative, err = paths.JoinRelative(*remote, *path)
	case remote != nil:
		relative = *remote
	case path != nil:
		relative = *path
	}
	if err != nil {
		return paths.Locator{}, err
	}
	return paths.Parse(fs, relative, home)
}
