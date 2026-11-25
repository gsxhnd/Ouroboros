package workspace

import (
	"encoding/json"
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/robfig/cron/v3"
)

func ValidateSchedule(schedule Schedule) error {
	if _, err := time.LoadLocation(schedule.Timezone); err != nil {
		return core.InvalidRequest("invalid timezone " + schedule.Timezone)
	}
	expression, err := schedule.CronExpression()
	if err != nil {
		return err
	}
	if schedule.Mode == ModeCron {
		if _, err := CronParser().Parse(expression); err != nil {
			return core.InvalidRequest("invalid cron expression: " + err.Error())
		}
	}
	return nil
}

// CronExpression returns the five-field cron expression a schedule runs on.
// Presets expand to a fixed expression; cron mode returns the user's text
// unparsed (ValidateSchedule checks its syntax).
func (s Schedule) CronExpression() (string, error) {
	switch s.Mode {
	case ModePreset:
		if s.Preset == nil {
			return "", core.InvalidRequest("preset schedule requires a preset")
		}
		switch *s.Preset {
		case PresetHourly:
			return "0 * * * *", nil
		case PresetWeekly:
			return "0 0 * * 0", nil
		default:
			return "0 0 * * *", nil
		}
	case ModeCron:
		if s.Cron == nil || *s.Cron == "" {
			return "", core.InvalidRequest("cron schedule requires a cron expression")
		}
		return *s.Cron, nil
	default:
		return "", core.InvalidRequest("invalid schedule mode")
	}
}

func CronParser() cron.Parser {
	return cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
}

type Schedule struct {
	Mode     ScheduleMode    `json:"mode"`
	Preset   *SchedulePreset `json:"preset,omitempty"`
	Cron     *string         `json:"cron,omitempty"`
	Timezone string          `json:"timezone"`
	Enabled  bool            `json:"enabled"`
}

func (s *Schedule) UnmarshalJSON(data []byte) error {
	type alias Schedule
	var raw alias
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	*s = Schedule(raw)
	if s.Timezone == "" {
		s.Timezone = "UTC"
	}
	return nil
}

func DisabledSchedule() Schedule {
	preset := PresetDaily
	return Schedule{Mode: ModePreset, Preset: &preset, Timezone: "UTC", Enabled: false}
}

type ScheduleMode string

const (
	ModePreset ScheduleMode = "preset"
	ModeCron   ScheduleMode = "cron"
)

type SchedulePreset string

const (
	PresetHourly SchedulePreset = "hourly"
	PresetDaily  SchedulePreset = "daily"
	PresetWeekly SchedulePreset = "weekly"
)
