package jobs

import (
	"context"
	"encoding/json"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/paths"
	"github.com/gsxhnd/ourboros/internal/rclone"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

type Status string

const (
	StatusQueued        Status = "queued"
	StatusRunning       Status = "running"
	StatusCancelling    Status = "cancelling"
	StatusSucceeded     Status = "succeeded"
	StatusFailed        Status = "failed"
	StatusPartialFailed Status = "partial_failed"
	StatusCancelled     Status = "cancelled"
	StatusExpired       Status = "expired"
)

func (s Status) Terminal() bool {
	switch s {
	case StatusSucceeded, StatusFailed, StatusPartialFailed, StatusCancelled, StatusExpired:
		return true
	default:
		return false
	}
}

type Progress struct {
	Bytes      uint64   `json:"bytes"`
	Transfers  uint64   `json:"transfers"`
	Checks     uint64   `json:"checks"`
	Errors     uint64   `json:"errors"`
	Percentage float64  `json:"percentage"`
	Speed      float64  `json:"speed"`
	ETASeconds *float64 `json:"eta_seconds"`
}

type Snapshot struct {
	ID          string              `json:"id"`
	EdgeID      string              `json:"edge_id"`
	Operation   workspace.Operation `json:"operation"`
	Status      Status              `json:"status"`
	Destructive bool                `json:"destructive"`
	Source      paths.Locator       `json:"source"`
	Target      paths.Locator       `json:"target"`
	Impact      string              `json:"impact"`
	Progress    Progress            `json:"progress"`
	Error       *string             `json:"error,omitempty"`
	StartedAt   time.Time           `json:"started_at"`
	FinishedAt  *time.Time          `json:"finished_at,omitempty"`
}

type record struct {
	snapshot    Snapshot
	rcloneJobID *int64
}

// maxFinishedJobs 限制已完成任务的保留数量，避免长期运行的实例无限累积快照。
const maxFinishedJobs = 100

type Store struct {
	mu           sync.Mutex
	jobs         map[string]*record
	runningEdges map[string]struct{}
	events       *events.Bus
	ctx          context.Context
}

func New(ctx context.Context, bus *events.Bus) *Store {
	if ctx == nil {
		ctx = context.Background()
	}
	return &Store{
		jobs:         map[string]*record{},
		runningEdges: map[string]struct{}{},
		events:       bus,
		ctx:          ctx,
	}
}

func (s *Store) List() []Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	jobs := make([]Snapshot, 0, len(s.jobs))
	for _, record := range s.jobs {
		jobs = append(jobs, record.snapshot)
	}
	sort.Slice(jobs, func(i, j int) bool { return jobs[i].StartedAt.After(jobs[j].StartedAt) })
	return jobs
}

func (s *Store) Get(id string) (Snapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	record, ok := s.jobs[id]
	if !ok {
		return Snapshot{}, core.NotFound("job " + id)
	}
	return record.snapshot, nil
}

func (s *Store) IsRunning(edgeID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.runningEdges[edgeID]
	return ok
}

func (s *Store) Start(rc *rclone.Supervisor, ws *workspace.Store, edgeID string, operation workspace.Operation, source, target paths.Locator) (Snapshot, error) {
	s.mu.Lock()
	if _, ok := s.runningEdges[edgeID]; ok {
		s.mu.Unlock()
		return Snapshot{}, core.Conflict("edge " + edgeID + " already has a running job")
	}
	id := uuid.NewString()
	snapshot := Snapshot{
		ID:          id,
		EdgeID:      edgeID,
		Operation:   operation,
		Status:      StatusRunning,
		Destructive: operation.Destructive(),
		Impact:      operation.Impact(source.Display(), target.Display()),
		Source:      source,
		Target:      target,
		StartedAt:   time.Now().UTC(),
	}
	s.runningEdges[edgeID] = struct{}{}
	s.jobs[id] = &record{snapshot: snapshot}
	s.mu.Unlock()
	s.emit(snapshot)

	body := map[string]any{
		"srcFs":  source.CombinedFS(),
		"dstFs":  target.CombinedFS(),
		"_async": true,
		"_group": snapshot.ID,
	}
	response, err := rc.CallInternal(s.ctx, operation.RcloneCommand(), body)
	if err != nil {
		s.fail(id, err.Error())
		return Snapshot{}, err
	}
	if !response.OK() {
		message := upstreamError(response.Body)
		s.fail(id, message)
		return Snapshot{}, core.Transport(message)
	}
	if jobID, ok := asInt64(response.Body["jobid"]); ok {
		s.mu.Lock()
		if record, exists := s.jobs[id]; exists {
			record.rcloneJobID = &jobID
		}
		s.mu.Unlock()
	}
	go s.pollUntilDone(rc, ws, id, edgeID)
	return s.Get(id)
}

// cancelWait 是 job/stop 之后等待 rclone 真正收尾（poller 观察到 job/status
// finished）的最长时间。超时后按取消兜底收尾并释放边锁。
const cancelWait = 5 * time.Second

func (s *Store) Stop(rc *rclone.Supervisor, jobID string) (Snapshot, error) {
	s.mu.Lock()
	record, ok := s.jobs[jobID]
	if !ok {
		s.mu.Unlock()
		return Snapshot{}, core.NotFound("job " + jobID)
	}
	if record.snapshot.Status.Terminal() {
		snapshot := record.snapshot
		s.mu.Unlock()
		return snapshot, nil
	}
	record.snapshot.Status = StatusCancelling
	rcloneJobID := record.rcloneJobID
	edgeID := record.snapshot.EdgeID
	cancelling := record.snapshot
	s.mu.Unlock()
	s.emit(cancelling)

	// rcloneJobID 可能还没落账（Start 的应答仍在路上）；给一个短暂的窗口。
	if rcloneJobID == nil {
		rcloneJobID = s.awaitJobID(jobID, time.Second)
	}
	if rcloneJobID != nil {
		_, _ = rc.CallInternal(s.ctx, "job/stop", map[string]any{"jobid": *rcloneJobID})
		// 等 poller 观察 rclone 真正结束后再收尾，而不是立刻宣布 cancelled：
		// 这期间传输可能仍在跑，边锁也必须保持。
		if snapshot, done := s.waitForTerminal(jobID, cancelWait); done {
			return snapshot, nil
		}
	}
	message := "job cancelled"
	return s.finish(jobID, edgeID, StatusCancelled, &message, nil)
}

// awaitJobID 以小步长轮询记录里的 rclone 任务 ID，最多等待 max；用于缓解
// Start 应答与 Stop 并发时的竞态。
func (s *Store) awaitJobID(jobID string, max time.Duration) *int64 {
	deadline := time.Now().Add(max)
	for {
		s.mu.Lock()
		record, ok := s.jobs[jobID]
		if ok && record.rcloneJobID != nil {
			id := record.rcloneJobID
			s.mu.Unlock()
			return id
		}
		s.mu.Unlock()
		if !time.Now().Before(deadline) {
			return nil
		}
		select {
		case <-s.ctx.Done():
			return nil
		case <-time.After(20 * time.Millisecond):
		}
	}
}

func (s *Store) waitForTerminal(jobID string, timeout time.Duration) (Snapshot, bool) {
	deadline := time.Now().Add(timeout)
	for {
		s.mu.Lock()
		record, ok := s.jobs[jobID]
		if ok && record.snapshot.Status.Terminal() {
			snapshot := record.snapshot
			s.mu.Unlock()
			return snapshot, true
		}
		s.mu.Unlock()
		if !time.Now().Before(deadline) {
			return Snapshot{}, false
		}
		select {
		case <-s.ctx.Done():
			return Snapshot{}, false
		case <-time.After(50 * time.Millisecond):
		}
	}
}

// reconcileCancel 把 poller 决定的终态与“正在取消”的当前状态合并：
// 用户主动取消的优先，最终状态应为 cancelled 而不是 failed。
func reconcileCancel(current, decided Status) Status {
	if current == StatusCancelling {
		return StatusCancelled
	}
	return decided
}

func (s *Store) pollUntilDone(rc *rclone.Supervisor, ws *workspace.Store, jobID, edgeID string) {
	for {
		select {
		case <-s.ctx.Done():
			return
		case <-time.After(500 * time.Millisecond):
		}
		s.mu.Lock()
		record, ok := s.jobs[jobID]
		if !ok || record.snapshot.Status.Terminal() {
			s.mu.Unlock()
			return
		}
		rcloneJobID := record.rcloneJobID
		s.mu.Unlock()

		if !rc.Status().Running {
			message := "rclone became unavailable"
			_, _ = s.finish(jobID, edgeID, StatusExpired, &message, nil)
			return
		}

		progress := Progress{}
		if stats, err := rc.CallInternal(s.ctx, "core/stats", map[string]any{"group": jobID, "short": true}); err == nil && stats.OK() {
			progress = parseStats(stats.Body)
		}

		finished := false
		success := false
		var jobErr *string
		if rcloneJobID != nil {
			response, err := rc.CallInternal(s.ctx, "job/status", map[string]any{"jobid": *rcloneJobID})
			if err != nil || !response.OK() {
				if !rc.Status().Running {
					message := "rclone became unavailable"
					_, _ = s.finish(jobID, edgeID, StatusExpired, &message, nil)
					return
				}
			} else {
				finished, _ = response.Body["finished"].(bool)
				success, _ = response.Body["success"].(bool)
				if message, ok := response.Body["error"].(string); ok && message != "" {
					jobErr = &message
				}
				if raw, ok := response.Body["progress"].(map[string]any); ok {
					mergeProgress(&progress, raw)
				}
			}
		}

		s.mu.Lock()
		if record, ok := s.jobs[jobID]; ok && !record.snapshot.Status.Terminal() {
			record.snapshot.Progress = progress
			snapshot := record.snapshot
			s.mu.Unlock()
			s.emit(snapshot)
		} else {
			s.mu.Unlock()
		}

		if finished {
			status := StatusSucceeded
			if !success {
				status = StatusFailed
			} else if progress.Errors > 0 {
				status = StatusPartialFailed
			}
			if final := reconcileCancel(s.currentStatus(jobID), status); final != status {
				status = final
				jobErr = nil
			}
			snapshot, err := s.finish(jobID, edgeID, status, jobErr, &progress)
			if err == nil {
				_, _ = ws.RecordJobResult(edgeID, workspace.LastResult{
					JobID:      snapshot.ID,
					Status:     string(snapshot.Status),
					FinishedAt: snapshot.FinishedAt,
					Error:      snapshot.Error,
				}, nil)
			}
			return
		}
	}
}

func (s *Store) fail(id, message string) {
	s.mu.Lock()
	edgeID := ""
	if record, ok := s.jobs[id]; ok {
		edgeID = record.snapshot.EdgeID
	}
	s.mu.Unlock()
	_, _ = s.finish(id, edgeID, StatusFailed, &message, nil)
}

// finish moves a job to a terminal state exactly once. Later calls (for example
// a poller that observed the job finishing just after it was cancelled) return
// the existing snapshot unchanged, so they cannot overwrite the final status or
// release the edge lock now held by a newer job on the same edge.
func (s *Store) finish(id, edgeID string, status Status, message *string, progress *Progress) (Snapshot, error) {
	s.mu.Lock()
	record, ok := s.jobs[id]
	if !ok {
		s.mu.Unlock()
		return Snapshot{}, core.NotFound("job " + id)
	}
	if record.snapshot.Status.Terminal() {
		snapshot := record.snapshot
		s.mu.Unlock()
		return snapshot, nil
	}
	delete(s.runningEdges, edgeID)
	record.snapshot.Status = status
	record.snapshot.Error = message
	now := time.Now().UTC()
	record.snapshot.FinishedAt = &now
	if progress != nil {
		record.snapshot.Progress = *progress
	}
	snapshot := record.snapshot
	s.mu.Unlock()
	s.pruneFinished()
	s.emit(snapshot)
	return snapshot, nil
}

// pruneFinished keeps at most maxFinishedJobs terminal jobs, dropping the
// oldest ones. Running jobs are never dropped.
func (s *Store) pruneFinished() {
	s.mu.Lock()
	defer s.mu.Unlock()
	var finished []string
	for id, record := range s.jobs {
		if record.snapshot.Status.Terminal() {
			finished = append(finished, id)
		}
	}
	if len(finished) <= maxFinishedJobs {
		return
	}
	sort.Slice(finished, func(i, j int) bool {
		return s.jobs[finished[i]].snapshot.StartedAt.Before(s.jobs[finished[j]].snapshot.StartedAt)
	})
	for _, id := range finished[:len(finished)-maxFinishedJobs] {
		delete(s.jobs, id)
	}
}

func (s *Store) emit(snapshot Snapshot) {
	if s.events != nil {
		s.events.Publish("job", snapshot)
	}
}

// currentStatus 在锁内读取一次快照状态；记录不存在时返回 queued（非取消态）。
func (s *Store) currentStatus(jobID string) Status {
	s.mu.Lock()
	defer s.mu.Unlock()
	record, ok := s.jobs[jobID]
	if !ok {
		return StatusQueued
	}
	return record.snapshot.Status
}

func parseStats(body map[string]any) Progress {
	progress := Progress{
		Bytes:     asUint(body["bytes"]),
		Transfers: asUint(body["transfers"]),
		Checks:    asUint(body["checks"]),
		Errors:    asUint(body["errors"]),
		Speed:     asFloat(body["speed"]),
	}
	if items, ok := body["transferring"].([]any); ok && len(items) > 0 {
		if item, ok := items[0].(map[string]any); ok {
			progress.Percentage = asFloat(item["percentage"])
		}
	}
	if eta, ok := asFloatPtr(body["eta"]); ok {
		progress.ETASeconds = &eta
	}
	return progress
}

func mergeProgress(progress *Progress, value map[string]any) {
	if _, ok := value["bytes"]; ok {
		progress.Bytes = asUint(value["bytes"])
	}
	if _, ok := value["percentage"]; ok {
		progress.Percentage = asFloat(value["percentage"])
	}
	if _, ok := value["speed"]; ok {
		progress.Speed = asFloat(value["speed"])
	}
	if eta, ok := asFloatPtr(value["eta"]); ok {
		progress.ETASeconds = &eta
	}
}

func upstreamError(body map[string]any) string {
	if message, ok := body["error"].(string); ok && message != "" {
		return message
	}
	return "rclone job failed"
}

func asUint(value any) uint64 {
	switch typed := value.(type) {
	case json.Number:
		n, _ := typed.Int64()
		if n < 0 {
			return 0
		}
		return uint64(n)
	case float64:
		if typed < 0 {
			return 0
		}
		return uint64(typed)
	default:
		return 0
	}
}

func asFloat(value any) float64 {
	number, _ := asFloatPtr(value)
	return number
}

func asFloatPtr(value any) (float64, bool) {
	switch typed := value.(type) {
	case json.Number:
		number, err := typed.Float64()
		return number, err == nil
	case float64:
		return typed, true
	default:
		return 0, false
	}
}

func asInt64(value any) (int64, bool) {
	switch typed := value.(type) {
	case json.Number:
		number, err := typed.Int64()
		return number, err == nil
	case float64:
		return int64(typed), true
	default:
		return 0, false
	}
}
