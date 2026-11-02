package rclone

import (
	"bytes"
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
)

func Scan(ctx context.Context, custom, managedDir string) []Candidate {
	var candidates []Candidate
	seen := map[string]struct{}{}
	add := func(candidate Candidate) {
		if _, ok := seen[candidate.Path]; ok {
			return
		}
		seen[candidate.Path] = struct{}{}
		candidates = append(candidates, candidate)
	}
	if custom != "" {
		add(inspect(ctx, custom, SourceCustom, false))
	}
	if managedDir != "" {
		for _, candidate := range scanManaged(ctx, managedDir) {
			add(candidate)
		}
	}
	for _, path := range findSystemBinaries() {
		add(inspect(ctx, path, SourceSystem, false))
	}
	return candidates
}

func inspect(ctx context.Context, path string, source SourceKind, managed bool) Candidate {
	version, err := ReadVersion(ctx, path)
	if err != nil {
		message := err.Error()
		return Candidate{Source: source, Path: path, Valid: false, Managed: managed, Error: &message}
	}
	return Candidate{Source: source, Path: path, Version: &version, Valid: true, Managed: managed}
}

func ReadVersion(ctx context.Context, path string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, path, "version")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if ctx.Err() == context.DeadlineExceeded {
		return "", core.ReadyTimeout()
	}
	if err != nil {
		if isNotFound(err) {
			return "", core.BinaryNotFound(path)
		}
		if cmd.ProcessState != nil && !cmd.ProcessState.Success() {
			return "", core.InvalidRequest("rclone version failed for " + path)
		}
		return "", core.IO(err)
	}
	version, ok := ParseVersionOutput(stdout.String())
	if !ok {
		return "", core.InvalidRequest("unrecognized rclone version output")
	}
	return version, nil
}

func ParseVersionOutput(stdout string) (string, bool) {
	line := strings.TrimSpace(strings.Split(stdout, "\n")[0])
	if line == "" {
		return "", false
	}
	for _, part := range strings.Fields(line) {
		if strings.HasPrefix(part, "v") || (part[0] >= '0' && part[0] <= '9') {
			if strings.HasPrefix(part, "v") {
				return part, true
			}
			return "v" + part, true
		}
	}
	return "", false
}

func ManagedBinaryPath(versionsDir, version string) string {
	exe := "rclone"
	if runtime.GOOS == "windows" {
		exe = "rclone.exe"
	}
	return filepath.Join(versionsDir, version, exe)
}

func scanManaged(ctx context.Context, managedDir string) []Candidate {
	entries, err := os.ReadDir(managedDir)
	if err != nil {
		return nil
	}
	var found []Candidate
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		path := ManagedBinaryPath(managedDir, entry.Name())
		info, err := os.Stat(path)
		if err != nil || info.IsDir() {
			continue
		}
		found = append(found, inspect(ctx, path, SourceManaged, true))
	}
	sort.Slice(found, func(i, j int) bool { return found[i].Path > found[j].Path })
	return found
}

func findSystemBinaries() []string {
	pathVar := os.Getenv("PATH")
	if pathVar == "" {
		return nil
	}
	names := []string{"rclone"}
	if runtime.GOOS == "windows" {
		names = []string{"rclone.exe", "rclone"}
	}
	var found []string
	seen := map[string]struct{}{}
	for _, dir := range filepath.SplitList(pathVar) {
		for _, name := range names {
			candidate := filepath.Join(dir, name)
			info, err := os.Stat(candidate)
			if err != nil || info.IsDir() {
				continue
			}
			if _, ok := seen[candidate]; ok {
				continue
			}
			seen[candidate] = struct{}{}
			found = append(found, candidate)
		}
	}
	return found
}
