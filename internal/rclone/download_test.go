package rclone

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"
)

func TestParseSHA256Sums(t *testing.T) {
	manifest := "abc123  rclone-v1.74.0-osx-arm64.zip\ndef456 *rclone-v1.74.0-linux-amd64.zip\n"
	got, err := ParseSHA256Sums(manifest, "rclone-v1.74.0-osx-arm64.zip")
	if err != nil || got != "abc123" {
		t.Fatalf("got %q %v", got, err)
	}
	got, err = ParseSHA256Sums(manifest, "rclone-v1.74.0-linux-amd64.zip")
	if err != nil || got != "def456" {
		t.Fatalf("got %q %v", got, err)
	}
	if _, err := ParseSHA256Sums(manifest, "missing.zip"); err == nil {
		t.Fatal("expected missing file to fail")
	}
}

func TestSHA256Hex(t *testing.T) {
	if got := sha256Hex([]byte("hello")); got != "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824" {
		t.Fatal(got)
	}
}

// ---- DownloadManager.run, end to end against a local download site ----

type site struct {
	server  *httptest.Server
	archive []byte
	// manifestSum overrides the checksum published for the archive.
	manifestSum string
	version     string
}

// fakeRcloneZip builds an archive holding a shell script that answers
// "version" the way rclone does, standing in for the real binary.
func fakeRcloneZip(t *testing.T, script string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	header := &zip.FileHeader{Name: "rclone-v1.99.0-linux-amd64/rclone", Method: zip.Deflate}
	header.SetMode(0o755)
	w, err := zw.CreateHeader(header)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.Write([]byte(script)); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

const goodScript = "#!/bin/sh\necho 'rclone v1.99.0'\n"

func startSite(t *testing.T, script string) *site {
	t.Helper()
	s := &site{archive: fakeRcloneZip(t, script), version: "v1.99.0"}
	release, err := ReleaseForPlatform(s.version)
	if err != nil {
		t.Skipf("no release archive for this platform: %v", err)
	}
	s.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/" + s.version + "/" + release.Filename:
			w.Header().Set("Content-Length", strconv.Itoa(len(s.archive)))
			_, _ = w.Write(s.archive)
		case "/" + s.version + "/SHA256SUMS":
			sum := s.manifestSum
			if sum == "" {
				sum = sha256Hex(s.archive)
			}
			_, _ = io.WriteString(w, sum+"  "+release.Filename+"\n")
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(s.server.Close)
	return s
}

func (s *site) manager() *DownloadManager {
	m := NewDownloadManager(nil)
	m.base = s.server.URL
	return m
}

// runDownload drives one download and returns the statuses it reported, in
// order and without consecutive duplicates.
func runDownload(t *testing.T, m *DownloadManager, ctx context.Context, version, dir string) ([]DownloadStatus, error) {
	t.Helper()
	var statuses []DownloadStatus
	id := "dl-test"
	m.mu.Lock()
	m.tasks = append(m.tasks, &downloadTask{snapshot: DownloadSnapshot{ID: id, Version: version, Status: DownloadQueued}, cancel: func() {}})
	m.mu.Unlock()
	err := m.run(ctx, id, version, dir, func(snapshot DownloadSnapshot) {
		if n := len(statuses); n == 0 || statuses[n-1] != snapshot.Status {
			statuses = append(statuses, snapshot.Status)
		}
	})
	return statuses, err
}

func TestDownloadRunInstallsVerifiedBinary(t *testing.T) {
	s := startSite(t, goodScript)
	dir := t.TempDir()

	statuses, err := runDownload(t, s.manager(), context.Background(), s.version, dir)
	if err != nil {
		t.Fatal(err)
	}
	want := []DownloadStatus{DownloadDownloading, DownloadVerifying, DownloadExtracting, DownloadCompleted}
	if len(statuses) != len(want) {
		t.Fatalf("statuses = %v, want %v", statuses, want)
	}
	for i := range want {
		if statuses[i] != want[i] {
			t.Fatalf("statuses = %v, want %v", statuses, want)
		}
	}
	info, err := os.Stat(ManagedBinaryPath(dir, s.version))
	if err != nil || info.Mode().Perm()&0o100 == 0 {
		t.Fatalf("installed binary missing or not executable: %v %v", info, err)
	}
}

func TestDownloadRunReportsTotalAndByteProgress(t *testing.T) {
	s := startSite(t, goodScript)
	m := s.manager()
	if _, err := runDownload(t, m, context.Background(), s.version, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	snapshot, err := m.Snapshot("dl-test")
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.TotalBytes == nil || *snapshot.TotalBytes != uint64(len(s.archive)) {
		t.Fatalf("total = %v, want %d", snapshot.TotalBytes, len(s.archive))
	}
	if snapshot.Bytes != uint64(len(s.archive)) {
		t.Fatalf("bytes = %d, want %d", snapshot.Bytes, len(s.archive))
	}
}

func TestDownloadRunRejectsChecksumMismatchAndInstallsNothing(t *testing.T) {
	s := startSite(t, goodScript)
	s.manifestSum = strings.Repeat("0", 64)
	dir := t.TempDir()

	statuses, err := runDownload(t, s.manager(), context.Background(), s.version, dir)
	if err == nil || !strings.Contains(err.Error(), "SHA-256 mismatch") {
		t.Fatalf("err = %v", err)
	}
	for _, status := range statuses {
		if status == DownloadExtracting || status == DownloadCompleted {
			t.Fatalf("reached %q despite a bad checksum: %v", status, statuses)
		}
	}
	if _, statErr := os.Stat(ManagedBinaryPath(dir, s.version)); !os.IsNotExist(statErr) {
		t.Fatal("an unverified binary was installed")
	}
}

func TestDownloadRunRemovesBinaryThatFailsVersionCheck(t *testing.T) {
	s := startSite(t, "#!/bin/sh\nexit 1\n")
	dir := t.TempDir()

	_, err := runDownload(t, s.manager(), context.Background(), s.version, dir)
	if err == nil {
		t.Fatal("expected the broken binary to be rejected")
	}
	if _, statErr := os.Stat(ManagedBinaryPath(dir, s.version)); !os.IsNotExist(statErr) {
		t.Fatal("a binary that failed its version check was left behind")
	}
}

// Cancelling before the request is sent fails inside the HTTP client, which
// never reaches the read loop. This cancels from the progress callback, i.e.
// after the first bytes arrived, so the loop's own check has to stop it.
func TestDownloadRunStopsWhenCancelledMidTransfer(t *testing.T) {
	s := startSite(t, goodScript)
	// Incompressible, so the stored body really spans several 32 KiB reads.
	padding := make([]byte, 256*1024)
	if _, err := rand.Read(padding); err != nil {
		t.Fatal(err)
	}
	s.archive = fakeRcloneZip(t, goodScript+"# "+hex.EncodeToString(padding)+"\n")
	dir := t.TempDir()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	m := s.manager()
	id := "dl-test"
	m.mu.Lock()
	m.tasks = append(m.tasks, &downloadTask{snapshot: DownloadSnapshot{ID: id, Version: s.version}, cancel: func() {}})
	m.mu.Unlock()

	var statuses []DownloadStatus
	err := m.run(ctx, id, s.version, dir, func(snapshot DownloadSnapshot) {
		if n := len(statuses); n == 0 || statuses[n-1] != snapshot.Status {
			statuses = append(statuses, snapshot.Status)
		}
		if snapshot.Bytes > 0 {
			cancel()
		}
	})
	if err == nil || !strings.Contains(err.Error(), "download cancelled") {
		t.Fatalf("err = %v, want the read loop's 'download cancelled'", err)
	}
	for _, status := range statuses {
		if status == DownloadVerifying || status == DownloadCompleted {
			t.Fatalf("kept going after cancel: %v", statuses)
		}
	}
	if _, statErr := os.Stat(ManagedBinaryPath(dir, s.version)); !os.IsNotExist(statErr) {
		t.Fatal("a cancelled download installed a binary")
	}
}

func TestDownloadRunFailsWhenSiteIsMissingTheRelease(t *testing.T) {
	s := startSite(t, goodScript)
	_, err := runDownload(t, s.manager(), context.Background(), "v9.9.9", t.TempDir())
	if err == nil || !strings.Contains(err.Error(), "404") {
		t.Fatalf("err = %v", err)
	}
}
