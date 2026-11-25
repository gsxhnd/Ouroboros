package rclone

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
)

const downloadsBase = "https://downloads.rclone.org"

type DownloadManager struct {
	client *Client
	// base is the download site's root URL. It is a field only so tests can
	// point the manager at a local server.
	base  string
	mu    sync.Mutex
	tasks []*downloadTask
}

type downloadTask struct {
	snapshot DownloadSnapshot
	cancel   context.CancelFunc
}

func NewDownloadManager(client *Client) *DownloadManager {
	if client == nil {
		client = NewClient()
	}
	return &DownloadManager{client: client, base: downloadsBase}
}

func (m *DownloadManager) Snapshot(id string) (DownloadSnapshot, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, task := range m.tasks {
		if task.snapshot.ID == id {
			return task.snapshot, nil
		}
	}
	return DownloadSnapshot{}, core.NotFound("download " + id)
}

func (m *DownloadManager) Start(ctx context.Context, version, versionsDir string, onProgress func(DownloadSnapshot)) (DownloadSnapshot, error) {
	version, err := SafeVersion(version)
	if err != nil {
		return DownloadSnapshot{}, err
	}
	id := fmt.Sprintf("dl-%s-%d", version, time.Now().UnixMilli())
	taskCtx, cancel := context.WithCancel(ctx)
	snapshot := DownloadSnapshot{ID: id, Version: version, Status: DownloadQueued}
	m.mu.Lock()
	m.tasks = append(m.tasks, &downloadTask{snapshot: snapshot, cancel: cancel})
	m.mu.Unlock()

	go func() {
		err := m.run(taskCtx, id, version, versionsDir, onProgress)
		if err != nil && taskCtx.Err() == nil {
			message := err.Error()
			m.update(id, func(snapshot *DownloadSnapshot) {
				snapshot.Status = DownloadFailed
				snapshot.Error = &message
			})
			if current, snapErr := m.Snapshot(id); snapErr == nil && onProgress != nil {
				onProgress(current)
			}
		}
	}()
	return snapshot, nil
}

func (m *DownloadManager) Cancel(id string) (DownloadSnapshot, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, task := range m.tasks {
		if task.snapshot.ID != id {
			continue
		}
		task.cancel()
		switch task.snapshot.Status {
		case DownloadCompleted, DownloadFailed, DownloadCancelled:
		default:
			task.snapshot.Status = DownloadCancelled
			message := "download cancelled"
			task.snapshot.Error = &message
		}
		return task.snapshot, nil
	}
	return DownloadSnapshot{}, core.NotFound("download " + id)
}

func (m *DownloadManager) update(id string, mutate func(*DownloadSnapshot)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, task := range m.tasks {
		if task.snapshot.ID == id {
			mutate(&task.snapshot)
			return
		}
	}
}

// run downloads, verifies and installs one rclone release. Each stage reports
// its status through emit so the UI can show where a download is.
func (m *DownloadManager) run(ctx context.Context, id, version, versionsDir string, onProgress func(DownloadSnapshot)) error {
	release, err := m.releaseFor(version)
	if err != nil {
		return err
	}
	m.emit(id, onProgress, func(snapshot *DownloadSnapshot) {
		snapshot.Status = DownloadDownloading
	})
	archive, err := m.fetchArchive(ctx, id, release, onProgress)
	if err != nil {
		return err
	}

	m.emit(id, onProgress, func(snapshot *DownloadSnapshot) {
		snapshot.Status = DownloadVerifying
	})
	if err := m.verifyArchive(ctx, release, archive); err != nil {
		return err
	}

	m.emit(id, onProgress, func(snapshot *DownloadSnapshot) {
		snapshot.Status = DownloadExtracting
	})
	if err := m.install(ctx, archive, version, versionsDir); err != nil {
		return err
	}
	m.emit(id, onProgress, func(snapshot *DownloadSnapshot) {
		snapshot.Status = DownloadCompleted
		snapshot.Error = nil
	})
	return nil
}

// releaseFor resolves version to this platform's archive, rooted at the
// manager's download base.
func (m *DownloadManager) releaseFor(version string) (Release, error) {
	release, err := ReleaseForPlatform(version)
	if err != nil {
		return Release{}, err
	}
	release.URL = m.base + "/" + release.Version + "/" + release.Filename
	return release, nil
}

// fetchArchive streams the release archive into memory, reporting byte
// progress, and stops promptly when ctx is cancelled.
func (m *DownloadManager) fetchArchive(ctx context.Context, id string, release Release, onProgress func(DownloadSnapshot)) ([]byte, error) {
	res, err := m.client.GetStream(ctx, release.URL)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.ContentLength > 0 {
		total := uint64(res.ContentLength)
		m.emit(id, onProgress, func(snapshot *DownloadSnapshot) {
			snapshot.TotalBytes = &total
		})
	}
	var buf bytes.Buffer
	chunk := make([]byte, 32*1024)
	for {
		if ctx.Err() != nil {
			return nil, core.InvalidRequest("download cancelled")
		}
		n, readErr := res.Body.Read(chunk)
		if n > 0 {
			buf.Write(chunk[:n])
			size := uint64(buf.Len())
			m.emit(id, onProgress, func(snapshot *DownloadSnapshot) {
				snapshot.Bytes = size
				snapshot.Status = DownloadDownloading
			})
		}
		if readErr == io.EOF {
			return buf.Bytes(), nil
		}
		if readErr != nil {
			return nil, core.Transport(readErr.Error())
		}
	}
}

// verifyArchive checks the archive against the official SHA-256 manifest.
func (m *DownloadManager) verifyArchive(ctx context.Context, release Release, archive []byte) error {
	manifest, err := m.client.GetText(ctx, m.base+"/"+release.Version+"/SHA256SUMS")
	if err != nil {
		return err
	}
	expected, err := ParseSHA256Sums(manifest, release.Filename)
	if err != nil {
		return err
	}
	if sha256Hex(archive) != expected {
		return core.InvalidRequest("SHA-256 mismatch for " + release.Filename)
	}
	return nil
}

// install unpacks the binary into versionsDir and confirms it runs; a binary
// that fails its version check is removed rather than left behind.
func (m *DownloadManager) install(ctx context.Context, archive []byte, version, versionsDir string) error {
	if err := os.MkdirAll(filepath.Join(versionsDir, version), 0o755); err != nil {
		return core.IO(err)
	}
	dest := ManagedBinaryPath(versionsDir, version)
	if err := extractRcloneBinary(archive, dest); err != nil {
		return err
	}
	candidate := inspect(ctx, dest, SourceManaged, true)
	if !candidate.Valid {
		_ = os.Remove(dest)
		message := "downloaded rclone failed version check"
		if candidate.Error != nil {
			message = *candidate.Error
		}
		return core.InvalidRequest(message)
	}
	return nil
}

func (m *DownloadManager) emit(id string, onProgress func(DownloadSnapshot), mutate func(*DownloadSnapshot)) {
	m.update(id, mutate)
	if onProgress == nil {
		return
	}
	if snapshot, err := m.Snapshot(id); err == nil {
		onProgress(snapshot)
	}
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
