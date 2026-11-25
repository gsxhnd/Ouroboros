// Package tray builds the text shown when hovering the desktop system tray
// icon. It is pure: it does not touch the windowing toolkit, so the logic can
// be tested on any platform. The tray's interactive UI is the webview panel,
// not a native menu.
package tray

import (
	"fmt"
	"strings"

	"github.com/gsxhnd/ourboros/internal/jobs"
	"github.com/gsxhnd/ourboros/internal/mounts"
	"github.com/gsxhnd/ourboros/internal/rclone"
)

// Input is the state the tooltip is rendered from.
type Input struct {
	Rclone     rclone.Status
	RcloneBusy bool // a start/stop request is in flight
	Mounts     []mounts.Snapshot
	Jobs       []jobs.Snapshot
}

// Tooltip summarises rclone, mount and job state in one line.
func Tooltip(in Input) string {
	parts := []string{"Ourboros", rcloneStatusLine(in)}
	if mounted := countMounted(in.Mounts); mounted > 0 {
		parts = append(parts, fmt.Sprintf("已挂载 %d", mounted))
	}
	if running := countRunning(in.Jobs); running > 0 {
		parts = append(parts, fmt.Sprintf("运行中任务 %d", running))
	}
	return strings.Join(parts, " · ")
}

func rcloneStatusLine(in Input) string {
	switch {
	case in.RcloneBusy:
		return "rclone 正在切换…"
	case !in.Rclone.Running:
		return "rclone 未运行"
	}
	parts := []string{"rclone 运行中"}
	if in.Rclone.Mode != nil {
		parts = append(parts, modeLabel(*in.Rclone.Mode))
	}
	if in.Rclone.Version != nil && *in.Rclone.Version != "" {
		parts = append(parts, *in.Rclone.Version)
	}
	if in.Rclone.OS != nil && in.Rclone.Arch != nil && *in.Rclone.OS != "" && *in.Rclone.Arch != "" {
		parts = append(parts, *in.Rclone.OS+"/"+*in.Rclone.Arch)
	}
	return strings.Join(parts, " · ")
}

func modeLabel(mode rclone.Mode) string {
	switch mode {
	case rclone.ModeSpawned:
		return "托管"
	case rclone.ModeAttached:
		return "外部连接"
	default:
		return string(mode)
	}
}

func countMounted(snapshots []mounts.Snapshot) int {
	count := 0
	for _, snap := range snapshots {
		if snap.Status == mounts.StatusMounted {
			count++
		}
	}
	return count
}

func countRunning(snapshots []jobs.Snapshot) int {
	count := 0
	for _, job := range snapshots {
		if !job.Status.Terminal() {
			count++
		}
	}
	return count
}
