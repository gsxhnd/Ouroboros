package workspace

import (
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/robfig/cron/v3"
)

func ValidateSchedule(schedule Schedule) error {
	if _, err := time.LoadLocation(schedule.Timezone); err != nil {
		return core.InvalidRequest("invalid timezone " + schedule.Timezone)
	}
	switch schedule.Mode {
	case ModePreset:
		if schedule.Preset == nil {
			return core.InvalidRequest("preset schedule requires a preset")
		}
	case ModeCron:
		if schedule.Cron == nil || *schedule.Cron == "" {
			return core.InvalidRequest("cron schedule requires a cron expression")
		}
		if _, err := CronParser().Parse(*schedule.Cron); err != nil {
			return core.InvalidRequest("invalid cron expression: " + err.Error())
		}
	default:
		return core.InvalidRequest("invalid schedule mode")
	}
	return nil
}

func CronParser() cron.Parser {
	return cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
}
