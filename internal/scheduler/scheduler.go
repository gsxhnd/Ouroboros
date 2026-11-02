package scheduler

import (
	"context"
	"log/slog"
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/jobs"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

func Run(ctx context.Context, ws *workspace.Store, jobStore *jobs.Store, rc *rclone.Supervisor) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := tick(ws, jobStore, rc); err != nil {
				slog.Warn("sync scheduler tick failed", "err", err)
			}
		}
	}
}

func tick(ws *workspace.Store, jobStore *jobs.Store, rc *rclone.Supervisor) error {
	doc := ws.Get()
	now := time.Now().UTC()
	for _, edge := range doc.Edges {
		if edge.Kind != workspace.EdgeSync || edge.Sync == nil {
			continue
		}
		sync := edge.Sync
		if !sync.Enabled || !sync.Schedule.Enabled {
			continue
		}
		if jobStore.IsRunning(edge.ID) {
			continue
		}
		if sync.NextRun == nil {
			computed, err := NextRunAt(sync.Schedule, now)
			if err != nil {
				return err
			}
			if computed != nil {
				if err := ws.SetNextRun(edge.ID, computed); err != nil {
					return err
				}
			}
			continue
		}
		if sync.NextRun.After(now) {
			continue
		}
		source, err := doc.NodeLocator(edge.Source, ws.Home())
		if err != nil {
			return err
		}
		target, err := doc.NodeLocator(edge.Target, ws.Home())
		if err != nil {
			return err
		}
		if _, err := jobStore.Start(rc, ws, edge.ID, sync.Operation, source, target); err != nil {
			slog.Warn("scheduled sync failed to start", "edge_id", edge.ID, "err", err)
			continue
		}
		computed, err := NextRunAt(sync.Schedule, time.Now().UTC())
		if err != nil {
			return err
		}
		if computed != nil {
			if err := ws.SetNextRun(edge.ID, computed); err != nil {
				return err
			}
		}
	}
	return nil
}

func CronExpression(schedule workspace.Schedule) (string, error) {
	switch schedule.Mode {
	case workspace.ModePreset:
		if schedule.Preset == nil {
			return "", core.InvalidRequest("preset schedule requires a preset")
		}
		switch *schedule.Preset {
		case workspace.PresetHourly:
			return "0 * * * *", nil
		case workspace.PresetWeekly:
			return "0 0 * * 0", nil
		default:
			return "0 0 * * *", nil
		}
	case workspace.ModeCron:
		if schedule.Cron == nil || *schedule.Cron == "" {
			return "", core.InvalidRequest("cron schedule requires a cron expression")
		}
		return *schedule.Cron, nil
	default:
		return "", core.InvalidRequest("invalid schedule mode")
	}
}

func NextRunAt(schedule workspace.Schedule, from time.Time) (*time.Time, error) {
	if !schedule.Enabled {
		return nil, nil
	}
	expression, err := CronExpression(schedule)
	if err != nil {
		return nil, err
	}
	parsed, err := workspace.CronParser().Parse(expression)
	if err != nil {
		return nil, core.InvalidRequest("invalid cron expression: " + err.Error())
	}
	location, err := time.LoadLocation(schedule.Timezone)
	if err != nil {
		return nil, core.InvalidRequest("invalid timezone " + schedule.Timezone)
	}
	next := parsed.Next(from.In(location)).UTC()
	return &next, nil
}
