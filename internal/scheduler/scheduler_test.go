package scheduler

import (
	"testing"
	"time"

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
