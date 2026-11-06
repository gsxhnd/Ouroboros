package scheduler

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/jobs"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

func TestNextRunHourly(t *testing.T) {
	preset := workspace.PresetHourly
	schedule := workspace.Schedule{
		Mode:     workspace.ModePreset,
		Preset:   &preset,
		Timezone: "UTC",
		Enabled:  true,
	}
	from := time.Date(2026, 9, 9, 10, 15, 0, 0, time.UTC)
	next, err := NextRunAt(schedule, from)
	if err != nil {
		t.Fatal(err)
	}
	want := time.Date(2026, 9, 9, 11, 0, 0, 0, time.UTC)
	if next == nil || !next.Equal(want) {
		t.Fatalf("next %v", next)
	}
}

func TestNextRunDisabled(t *testing.T) {
	next, err := NextRunAt(workspace.DisabledSchedule(), time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	if next != nil {
		t.Fatal("expected nil")
	}
}

// 一个损坏的调度单元（例如无效时区）只应让自身报错，不能中断同一轮 tick
// 中其他单元的求值：坏单元排在前面，好单元仍要完成 NextRun 的落盘。
func TestTickContinuesPastBrokenUnit(t *testing.T) {
	home := t.TempDir()
	dir := filepath.Join(home, "a")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	// 直接落一个磁盘文档（绕过 API 校验，模拟手改文件）：第一个 sync 边带无效
	// 时区（每次求值必失败），第二个是健康的 hourly 计划、NextRun 为空。
	doc := `{
	  "schema_version": 1,
	  "revision": 1,
	  "nodes": [
	    {"id": "a", "kind": "local", "label": "a", "position": {"x":0,"y":0}, "local_path": "%s"},
	    {"id": "b", "kind": "local", "label": "b", "position": {"x":1,"y":0}, "local_path": "%s"}
	  ],
	  "edges": [
	    {"id": "bad", "source": "a", "target": "b", "kind": "sync",
	     "sync": {"operation": "copy", "enabled": true,
	              "schedule": {"mode": "preset", "preset": "hourly", "timezone": "Not/AZone", "enabled": true}}},
	    {"id": "good", "source": "a", "target": "b", "kind": "sync",
	     "sync": {"operation": "copy", "enabled": true,
	              "schedule": {"mode": "preset", "preset": "hourly", "timezone": "UTC", "enabled": true}}}
	  ]
	}`
	target := filepath.Join(home, "b")
	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(home, "workspace.json")
	if err := os.WriteFile(path, []byte(fmt.Sprintf(doc, dir, target)), 0o644); err != nil {
		t.Fatal(err)
	}
	ws, err := workspace.LoadOrCreate(path, home)
	if err != nil {
		t.Fatal(err)
	}

	err = tick(ws, jobs.New(context.Background(), events.New()), nil)
	if err == nil {
		t.Fatal("expected error about edge bad")
	}
	if !strings.Contains(err.Error(), "edge bad") {
		t.Fatalf("expected joined error to mention edge bad: %v", err)
	}
	after := ws.Get()
	found := false
	for _, edge := range after.Edges {
		if edge.ID == "good" && edge.Sync != nil && edge.Sync.NextRun != nil {
			found = true
		}
	}
	if !found {
		t.Fatal("healthy edge did not get its next run computed; the broken edge still blocks the tick")
	}
}
