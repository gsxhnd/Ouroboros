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
	"github.com/gsxhnd/ourboros/internal/workspace"
)

func Run(ctx context.Context, ws *workspace.Store, jobStore *jobs.Store) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := tick(ws, jobStore); err != nil {
				slog.Warn("sync scheduler tick failed", "err", err)
			}
		}
	}
}

func tick(ws *workspace.Store, jobStore *jobs.Store) error {
	doc := ws.Get()
	var errs []error
	for _, edge := range doc.Edges {
		if edge.Kind != workspace.EdgeSync || edge.Sync == nil {
			continue
		}
		// 双向同步（bisync）必须先手动完成一次 resync 初始化，否则计划任务
		// 每轮都会失败。
		if edge.Sync.Operation.TwoWay() && edge.Sync.LastResult == nil {
			continue
		}
		unit := runUnit{
			id:        edge.ID,
			enabled:   edge.Sync.Enabled,
			schedule:  edge.Sync.Schedule,
			nextRun:   edge.Sync.NextRun,
			operation: edge.Sync.Operation,
			options: jobs.Options{
				BWLimit:     edge.Sync.BWLimit,
				MaxTransfer: edge.Sync.MaxTransfer,
			},
			endpoints: func() (paths.Locator, paths.Locator, error) {
				source, err := doc.NodeLocator(edge.Source, ws.Home())
				if err != nil {
					return paths.Locator{}, paths.Locator{}, err
				}
				target, err := doc.NodeLocator(edge.Target, ws.Home())
				return source, target, err
			},
		}
		if err := runDue(ws, jobStore, unit); err != nil {
			// 一个坏掉的单元（例如无效的 cron 表达式）不应阻塞同一轮里其他单元的求值。
			errs = append(errs, fmt.Errorf("edge %s: %w", edge.ID, err))
		}
	}
	return errors.Join(errs...)
}

// runUnit 是一个可按计划运行的单元：同步边。
type runUnit struct {
	id        string
	enabled   bool
	schedule  workspace.Schedule
	nextRun   *time.Time
	operation workspace.Operation
	options   jobs.Options
	endpoints func() (paths.Locator, paths.Locator, error)
}

func runDue(ws *workspace.Store, jobStore *jobs.Store, unit runUnit) error {
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
	if _, err := jobStore.Start(unit.id, unit.operation, source, target, unit.options); err != nil {
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

func NextRunAt(schedule workspace.Schedule, from time.Time) (*time.Time, error) {
	if !schedule.Enabled {
		return nil, nil
	}
	expression, err := schedule.CronExpression()
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
