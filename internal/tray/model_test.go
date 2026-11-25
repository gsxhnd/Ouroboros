package tray

import (
	"strings"
	"testing"

	"github.com/gsxhnd/ourboros/internal/jobs"
	"github.com/gsxhnd/ourboros/internal/mounts"
	"github.com/gsxhnd/ourboros/internal/rclone"
)

func ptr[T any](v T) *T { return &v }

func TestTooltipStoppedRclone(t *testing.T) {
	got := Tooltip(Input{Rclone: rclone.Status{Running: false}})
	if got != "Ourboros · rclone 未运行" {
		t.Fatalf("tooltip = %q", got)
	}
}

func TestTooltipRunningRcloneShowsModeAndVersion(t *testing.T) {
	got := Tooltip(Input{Rclone: rclone.Status{
		Running: true,
		Mode:    ptr(rclone.ModeSpawned),
		Version: ptr("v1.74.0"),
	}})
	if got != "Ourboros · rclone 运行中 · 托管 · v1.74.0" {
		t.Fatalf("tooltip = %q", got)
	}
}

func TestTooltipBusyRcloneDisplaysTransition(t *testing.T) {
	for _, running := range []bool{false, true} {
		got := Tooltip(Input{RcloneBusy: true, Rclone: rclone.Status{Running: running}})
		if got != "Ourboros · rclone 正在切换…" {
			t.Fatalf("running=%v tooltip = %q", running, got)
		}
	}
}

func TestTooltipCountsOnlyMountedMounts(t *testing.T) {
	got := Tooltip(Input{
		Rclone: rclone.Status{Running: true, Mode: ptr(rclone.ModeAttached), Version: ptr("v1.75.2")},
		Mounts: []mounts.Snapshot{
			{EdgeID: "a", Status: mounts.StatusMounted},
			{EdgeID: "b", Status: mounts.StatusStopped},
			{EdgeID: "c", Status: mounts.StatusStarting},
			{EdgeID: "d", Status: mounts.StatusFailed},
		},
	})
	want := "Ourboros · rclone 运行中 · 外部连接 · v1.75.2 · 已挂载 1"
	if got != want {
		t.Fatalf("tooltip = %q, want %q", got, want)
	}
}

func TestTooltipCountsOnlyRunningJobs(t *testing.T) {
	var all []jobs.Snapshot
	for i := 0; i < 8; i++ {
		all = append(all, jobs.Snapshot{ID: strings.Repeat("j", i+1), Status: jobs.StatusRunning})
	}
	all = append(all, jobs.Snapshot{ID: "done", Status: jobs.StatusSucceeded})

	got := Tooltip(Input{Jobs: all})
	if !strings.Contains(got, "运行中任务 8") {
		t.Fatalf("tooltip = %q, want terminal jobs excluded", got)
	}
}
