// Package tray turns the live state of the Ourboros services into the view
// model shown by the desktop system tray. It is pure: it does not touch the
// windowing toolkit, so the menu logic can be tested on any platform.
package tray

import (
	"fmt"
	"strings"

	"github.com/gsxhnd/ourboros/internal/jobs"
	"github.com/gsxhnd/ourboros/internal/mounts"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

// maxJobRows caps how many running jobs are listed inline so a large batch
// cannot make the tray menu unusably tall.
const maxJobRows = 5

// Input is the state a tray menu is rendered from.
type Input struct {
	// Workspace resolves node IDs in mount snapshots to readable names. Mount
	// snapshots carry raw node IDs whenever a mount is not running.
	Workspace  workspace.Document
	Rclone     rclone.Status
	RcloneBusy bool // a start/stop request is in flight
	Mounts     []mounts.Snapshot
	Jobs       []jobs.Snapshot
	// Autostart is nil when launch-at-login is not supported on this platform.
	Autostart *bool
	// LastError is the message of the most recent failed tray action.
	LastError string
}

// Model is the rendered tray menu.
type Model struct {
	Tooltip       string
	StatusLine    string
	RcloneRunning bool
	RcloneBusy    bool
	ToggleLabel   string
	Mounts        []MountRow
	MountedCount  int
	RunningJobs   []JobRow
	// TotalJobs is the number of running jobs, which can exceed len(RunningJobs).
	TotalJobs int
	Autostart *bool
	LastError string
}

// MountRow is one mount connection in the "挂载" submenu.
type MountRow struct {
	EdgeID  string
	Label   string
	Checked bool
	Enabled bool
	Hint    string
}

// JobRow is one running sync/copy/move job in the tasks submenu.
type JobRow struct {
	ID    string
	Label string
}

// Build computes the tray model for the given state.
func Build(in Input) Model {
	m := Model{
		RcloneRunning: in.Rclone.Running,
		RcloneBusy:    in.RcloneBusy,
		Autostart:     in.Autostart,
		LastError:     in.LastError,
	}

	m.StatusLine = rcloneStatusLine(in)
	m.ToggleLabel = toggleLabel(in)

	for _, snap := range in.Mounts {
		row, mounted := mountRow(in.Workspace, snap)
		m.Mounts = append(m.Mounts, row)
		if mounted {
			m.MountedCount++
		}
	}

	for _, job := range in.Jobs {
		if job.Status.Terminal() {
			continue
		}
		m.TotalJobs++
		if len(m.RunningJobs) < maxJobRows {
			m.RunningJobs = append(m.RunningJobs, JobRow{ID: job.ID, Label: jobLabel(job)})
		}
	}

	m.Tooltip = tooltip(m)
	return m
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

func toggleLabel(in Input) string {
	switch {
	case in.RcloneBusy && in.Rclone.Running:
		return "正在停止 rclone…"
	case in.RcloneBusy:
		return "正在启动 rclone…"
	case in.Rclone.Running:
		return "停止 rclone"
	default:
		return "启动 rclone"
	}
}

// mountRow maps a mount snapshot to a menu row. The boolean reports whether the
// mount is currently attached, which drives the mounted count in the tooltip.
func mountRow(doc workspace.Document, snap mounts.Snapshot) (MountRow, bool) {
	row := MountRow{
		EdgeID:  snap.EdgeID,
		Label:   mountLabel(doc, snap.EdgeID),
		Enabled: true,
	}
	switch snap.Status {
	case mounts.StatusMounted:
		row.Checked = true
		return row, true
	case mounts.StatusStarting:
		row.Checked = true
		row.Enabled = false
		row.Hint = "挂载中…"
		return row, false
	case mounts.StatusStopping:
		row.Checked = true
		row.Enabled = false
		row.Hint = "卸载中…"
		return row, false
	case mounts.StatusFailed:
		row.Hint = "上次挂载失败"
	}
	return row, false
}

// mountLabel reads "remote → local path" from the workspace, falling back to the
// edge ID when the edge is missing.
func mountLabel(doc workspace.Document, edgeID string) string {
	edge := doc.Edge(edgeID)
	if edge == nil {
		return edgeID
	}
	return nodeName(doc, edge.Source) + " → " + nodeName(doc, edge.Target)
}

// nodeName shows a remote by its label and a local node by its directory, since
// the directory is what the user actually needs to find.
func nodeName(doc workspace.Document, id string) string {
	node := doc.Node(id)
	if node == nil {
		return "未知节点"
	}
	if node.Kind == workspace.NodeLocal && node.LocalPath != nil && *node.LocalPath != "" {
		return *node.LocalPath
	}
	return node.Label
}

func jobLabel(job jobs.Snapshot) string {
	label := fmt.Sprintf("%s %s → %s", job.Operation, job.Source.Display(), job.Target.Display())
	if job.Progress.Percentage > 0 {
		label += fmt.Sprintf(" · %.0f%%", job.Progress.Percentage)
	}
	return label
}

func tooltip(m Model) string {
	parts := []string{"Ourboros", m.StatusLine}
	if m.MountedCount > 0 {
		parts = append(parts, fmt.Sprintf("已挂载 %d", m.MountedCount))
	}
	if m.TotalJobs > 0 {
		parts = append(parts, fmt.Sprintf("运行中任务 %d", m.TotalJobs))
	}
	return strings.Join(parts, " · ")
}
