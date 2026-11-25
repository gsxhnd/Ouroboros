package rclone

import (
	"context"
	"fmt"
	"runtime"
	"strings"

	"github.com/gsxhnd/ourboros/internal/core"
)

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
