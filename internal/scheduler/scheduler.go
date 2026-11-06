package scheduler

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/jobs"
	"github.com/gsxhnd/ourboros/internal/paths"
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
	var errs []error
	for _, edge := range doc.Edges {
		if edge.Kind != workspace.EdgeSync || edge.Sync == nil {
			continue
		}
		unit := runUnit{
			id:        edge.ID,
			enabled:   edge.Sync.Enabled,
			schedule:  edge.Sync.Schedule,
			nextRun:   edge.Sync.NextRun,
			operation: edge.Sync.Operation,
			endpoints: func() (paths.Locator, paths.Locator, error) {
				source, err := doc.NodeLocator(edge.Source, ws.Home())
				if err != nil {
					return paths.Locator{}, paths.Locator{}, err
				}
				target, err := doc.NodeLocator(edge.Target, ws.Home())
				return source, target, err
			},
		}
		if err := runDue(ws, jobStore, rc, unit); err != nil {
			// 一个坏掉的单元（例如无效的 cron 表达式）不应阻塞同一轮里其他单元的求值。
			errs = append(errs, fmt.Errorf("edge %s: %w", edge.ID, err))
		}
	}
	for _, node := range doc.Nodes {
		if node.Kind != workspace.NodeAction || node.Action == nil {
			continue
		}
		nodeID := node.ID
		action := node.Action
		unit := runUnit{
			id:        nodeID,
			enabled:   action.Enabled,
			schedule:  action.Schedule,
			nextRun:   action.NextRun,
			operation: action.Operation,
			endpoints: func() (paths.Locator, paths.Locator, error) {
				source, target, err := workspace.ActionEndpoints(doc, nodeID)
				if err != nil {
					return paths.Locator{}, paths.Locator{}, err
				}
				from, err := source.Locator(ws.Home())
				if err != nil {
					return paths.Locator{}, paths.Locator{}, err
				}
				to, err := target.Locator(ws.Home())
				return from, to, err
			},
		}
		if err := runDue(ws, jobStore, rc, unit); err != nil {
			errs = append(errs, fmt.Errorf("node %s: %w", nodeID, err))
		}
	}
	return errors.Join(errs...)
}

// runUnit 是一个可按计划运行的单元：同步边或动作节点。
type runUnit struct {
	id        string
	enabled   bool
	schedule  workspace.Schedule
	nextRun   *time.Time
	operation workspace.Operation
	endpoints func() (paths.Locator, paths.Locator, error)
}

func runDue(ws *workspace.Store, jobStore *jobs.Store, rc *rclone.Supervisor, unit runUnit) error {
	now := time.Now().UTC()
	if !unit.enabled || !unit.schedule.Enabled {
		return nil
	}
	if jobStore.IsRunning(unit.id) {
		return nil
	}
	if unit.nextRun == nil {
		computed, err := NextRunAt(unit.schedule, now)
		if err != nil {
			return err
		}
		if computed != nil {
			return ws.SetNextRun(unit.id, computed)
		}
		return nil
	}
	if unit.nextRun.After(now) {
		return nil
	}
	source, target, err := unit.endpoints()
	if err != nil {
		return err
	}
	if _, err := jobStore.Start(rc, ws, unit.id, unit.operation, source, target); err != nil {
		slog.Warn("scheduled run failed to start", "id", unit.id, "err", err)
		return nil
	}
	computed, err := NextRunAt(unit.schedule, time.Now().UTC())
	if err != nil || computed == nil {
		slog.Warn("scheduled run finished but next occurrence could not be computed; backing off one hour", "id", unit.id, "err", err)
		fallback := time.Now().UTC().Add(time.Hour)
		computed = &fallback
	}
	return ws.SetNextRun(unit.id, computed)
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
