package rclone

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
)

const downloadsBase = "https://downloads.rclone.org"

type DownloadManager struct {
	client *Client
	mu     sync.Mutex
	tasks  []*downloadTask
}

type downloadTask struct {
	snapshot DownloadSnapshot
	cancel   context.CancelFunc
}

func NewDownloadManager(client *Client) *DownloadManager {
	if client == nil {
		client = NewClient()
	}
	return &DownloadManager{client: client}
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

func (m *DownloadManager) run(ctx context.Context, id, version, versionsDir string, onProgress func(DownloadSnapshot)) error {
	release, err := ReleaseForPlatform(version)
	if err != nil {
		return err
	}
	m.emit(id, onProgress, func(snapshot *DownloadSnapshot) {
		snapshot.Status = DownloadDownloading
	})
	res, err := m.client.GetStream(ctx, release.URL)
	if err != nil {
		return err
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
			return core.InvalidRequest("download cancelled")
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
			break
		}
		if readErr != nil {
			return core.Transport(readErr.Error())
		}
	}

	m.emit(id, onProgress, func(snapshot *DownloadSnapshot) {
		snapshot.Status = DownloadVerifying
	})
	manifest, err := m.client.GetText(ctx, downloadsBase+"/"+version+"/SHA256SUMS")
	if err != nil {
		return err
	}
	expected, err := ParseSHA256Sums(manifest, release.Filename)
	if err != nil {
		return err
	}
	actual := sha256Hex(buf.Bytes())
	if actual != expected {
		return core.InvalidRequest("SHA-256 mismatch for " + release.Filename)
	}

	m.emit(id, onProgress, func(snapshot *DownloadSnapshot) {
		snapshot.Status = DownloadExtracting
	})
	if err := os.MkdirAll(filepath.Join(versionsDir, version), 0o755); err != nil {
		return core.IO(err)
	}
	dest := ManagedBinaryPath(versionsDir, version)
	if err := extractRcloneBinary(buf.Bytes(), dest); err != nil {
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
	m.emit(id, onProgress, func(snapshot *DownloadSnapshot) {
		snapshot.Status = DownloadCompleted
		snapshot.Error = nil
	})
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

func CurrentRelease(ctx context.Context, client *Client) (Release, error) {
	text, err := client.GetText(ctx, downloadsBase+"/version.txt")
	if err != nil {
		return Release{}, err
	}
	version, ok := ParseVersionOutput(text)
	if !ok {
		return Release{}, core.Transport("could not parse rclone version.txt")
	}
	return ReleaseForPlatform(version)
}

func ReleaseForPlatform(version string) (Release, error) {
	version = NormalizeVersion(version)
	filename, err := archiveName(version)
	if err != nil {
		return Release{}, err
	}
	return Release{
		Version:  version,
		Filename: filename,
		URL:      downloadsBase + "/" + version + "/" + filename,
	}, nil
}

func ParseSHA256Sums(manifest, filename string) (string, error) {
	for _, line := range strings.Split(manifest, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}
		name := strings.TrimPrefix(parts[1], "*")
		if name == filename {
			return strings.ToLower(parts[0]), nil
		}
	}
	return "", core.NotFound("SHA-256 entry for " + filename)
}

func extractRcloneBinary(zipBytes []byte, dest string) error {
	reader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	if err != nil {
		return core.InvalidRequest("invalid rclone zip: " + err.Error())
	}
	for _, file := range reader.File {
		name := strings.ReplaceAll(file.Name, `\`, "/")
		if strings.Contains(name, "__MACOSX") {
			continue
		}
		base := name
		if slash := strings.LastIndex(name, "/"); slash >= 0 {
			base = name[slash+1:]
		}
		if base != "rclone" && base != "rclone.exe" {
			continue
		}
		if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
			return core.IO(err)
		}
		src, err := file.Open()
		if err != nil {
			return core.InvalidRequest("invalid rclone zip: " + err.Error())
		}
		out, err := os.OpenFile(dest, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o755)
		if err != nil {
			src.Close()
			return core.IO(err)
		}
		_, copyErr := io.Copy(out, src)
		src.Close()
		closeErr := out.Close()
		if copyErr != nil {
			return core.IO(copyErr)
		}
		if closeErr != nil {
			return core.IO(closeErr)
		}
		if runtime.GOOS != "windows" {
			if err := os.Chmod(dest, 0o755); err != nil {
				return core.IO(err)
			}
		}
		return nil
	}
	return core.NotFound("rclone binary inside downloaded archive")
}

func archiveName(version string) (string, error) {
	var osArch string
	switch runtime.GOOS + "/" + runtime.GOARCH {
	case "darwin/arm64":
		osArch = "osx-arm64"
	case "darwin/amd64":
		osArch = "osx-amd64"
	case "linux/arm64":
		osArch = "linux-arm64"
	case "linux/amd64":
		osArch = "linux-amd64"
	case "windows/arm64":
		osArch = "windows-arm64"
	case "windows/amd64":
		osArch = "windows-amd64"
	default:
		return "", core.InvalidRequest("unsupported platform " + runtime.GOOS + "/" + runtime.GOARCH)
	}
	return fmt.Sprintf("rclone-%s-%s.zip", version, osArch), nil
}

func NormalizeVersion(version string) string {
	trimmed := strings.TrimSpace(version)
	trimmed = strings.TrimSpace(strings.TrimPrefix(trimmed, "rclone"))
	if strings.HasPrefix(trimmed, "v") {
		return trimmed
	}
	return "v" + trimmed
}

func SafeVersion(version string) (string, error) {
	version = NormalizeVersion(version)
	if version == "v" || strings.ContainsAny(version, `/\`) || strings.Contains(version, "..") {
		return "", core.InvalidRequest("invalid rclone version")
	}
	return version, nil
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
