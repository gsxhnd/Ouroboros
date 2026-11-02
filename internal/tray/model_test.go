package tray

import (
	"strings"
	"testing"

	"github.com/gsxhnd/ourboros/internal/jobs"
	"github.com/gsxhnd/ourboros/internal/mounts"
	"github.com/gsxhnd/ourboros/internal/paths"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

func ptr[T any](v T) *T { return &v }

func TestBuildStoppedRclone(t *testing.T) {
	m := Build(Input{Rclone: rclone.Status{Running: false}})
	if m.RcloneRunning {
		t.Fatal("expected not running")
	}
	if m.ToggleLabel != "启动 rclone" {
		t.Fatalf("toggle = %q", m.ToggleLabel)
	}
	if m.StatusLine != "rclone 未运行" {
		t.Fatalf("status = %q", m.StatusLine)
	}
	if m.Autostart != nil {
		t.Fatal("autostart should be absent when unsupported")
	}
}

func TestBuildRunningRcloneShowsModeAndVersion(t *testing.T) {
	m := Build(Input{Rclone: rclone.Status{
		Running: true,
		Mode:    ptr(rclone.ModeSpawned),
		Version: ptr("v1.74.0"),
	}})
	if m.ToggleLabel != "停止 rclone" {
		t.Fatalf("toggle = %q", m.ToggleLabel)
	}
	if m.StatusLine != "rclone 运行中 · 托管 · v1.74.0" {
		t.Fatalf("status = %q", m.StatusLine)
	}
}

func TestBuildBusyRcloneDisplaysTransition(t *testing.T) {
	starting := Build(Input{RcloneBusy: true})
	if starting.ToggleLabel != "正在启动 rclone…" || starting.StatusLine != "rclone 正在切换…" {
		t.Fatalf("starting: %+v", starting)
	}
	stopping := Build(Input{RcloneBusy: true, Rclone: rclone.Status{Running: true}})
	if stopping.ToggleLabel != "正在停止 rclone…" {
		t.Fatalf("stopping toggle = %q", stopping.ToggleLabel)
	}
}

func testWorkspace() workspace.Document {
	local := func(path string) *string { return &path }
	return workspace.Document{
		Nodes: []workspace.Node{
			{ID: "r-photos", Kind: workspace.NodeRemote, Label: "相册"},
			{ID: "l-a", Kind: workspace.NodeLocal, Label: "挂载 A", LocalPath: local("/mnt/a")},
			{ID: "r-s3", Kind: workspace.NodeRemote, Label: "S3"},
			{ID: "l-b", Kind: workspace.NodeLocal, Label: "挂载 B", LocalPath: local("/mnt/b")},
		},
		Edges: []workspace.Edge{
			{ID: "a", Kind: workspace.EdgeMount, Source: "r-photos", Target: "l-a"},
			{ID: "b", Kind: workspace.EdgeMount, Source: "r-s3", Target: "l-b"},
			{ID: "c", Kind: workspace.EdgeMount, Source: "r-s3", Target: "l-b"},
			{ID: "d", Kind: workspace.EdgeMount, Source: "r-s3", Target: "l-b"},
		},
	}
}

func TestMountRowsReflectStatus(t *testing.T) {
	m := Build(Input{Workspace: testWorkspace(), Mounts: []mounts.Snapshot{
		{EdgeID: "a", Status: mounts.StatusMounted},
		{EdgeID: "b", Status: mounts.StatusStopped},
		{EdgeID: "c", Status: mounts.StatusStarting},
		{EdgeID: "d", Status: mounts.StatusFailed},
	}})
	if m.MountedCount != 1 {
		t.Fatalf("mounted count = %d", m.MountedCount)
	}
	if len(m.Mounts) != 4 {
		t.Fatalf("rows = %d", len(m.Mounts))
	}
	mounted, stopped, starting, failed := m.Mounts[0], m.Mounts[1], m.Mounts[2], m.Mounts[3]
	if !mounted.Checked || !mounted.Enabled {
		t.Fatalf("mounted row: %+v", mounted)
	}
	if mounted.Label != "相册 → /mnt/a" {
		t.Fatalf("label = %q", mounted.Label)
	}
	if stopped.Label != "S3 → /mnt/b" {
		t.Fatalf("stopped label = %q (must not show raw IDs)", stopped.Label)
	}
	if stopped.Checked || !stopped.Enabled || stopped.Hint != "" {
		t.Fatalf("stopped row: %+v", stopped)
	}
	if !starting.Checked || starting.Enabled || starting.Hint == "" {
		t.Fatalf("starting row must be disabled while in progress: %+v", starting)
	}
	if failed.Checked || !failed.Enabled || failed.Hint == "" {
		t.Fatalf("failed row should be retryable with a hint: %+v", failed)
	}
}

func TestRunningJobsExcludeTerminalAndAreCapped(t *testing.T) {
	var all []jobs.Snapshot
	for i := 0; i < 8; i++ {
		all = append(all, jobs.Snapshot{
			ID:        strings.Repeat("j", i+1),
			Operation: "copy",
			Status:    jobs.StatusRunning,
			Source:    paths.Locator{FS: "/src"},
			Target:    paths.Locator{FS: "/dst"},
		})
	}
	all = append(all, jobs.Snapshot{ID: "done", Status: jobs.StatusSucceeded})

	m := Build(Input{Jobs: all})
	if m.TotalJobs != 8 {
		t.Fatalf("total = %d, want 8 (terminal jobs excluded)", m.TotalJobs)
	}
	if len(m.RunningJobs) != maxJobRows {
		t.Fatalf("listed = %d, want cap %d", len(m.RunningJobs), maxJobRows)
	}
	if !strings.Contains(m.Tooltip, "运行中任务 8") {
		t.Fatalf("tooltip = %q", m.Tooltip)
	}
}

func TestTooltipSummarisesState(t *testing.T) {
	m := Build(Input{
		Rclone:    rclone.Status{Running: true, Mode: ptr(rclone.ModeAttached), Version: ptr("v1.75.2")},
		Workspace: testWorkspace(),
		Mounts:    []mounts.Snapshot{{EdgeID: "a", Status: mounts.StatusMounted}},
	})
	want := "Ourboros · rclone 运行中 · 外部连接 · v1.75.2 · 已挂载 1"
	if m.Tooltip != want {
		t.Fatalf("tooltip = %q, want %q", m.Tooltip, want)
	}
}
