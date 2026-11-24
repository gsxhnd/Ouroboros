package jobs

import (
	"context"
	"encoding/json"
	"log/slog"
	"sort"
	"strings"
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

// Options 携带一次同步运行的参数。
type Options struct {
	// BWLimit 限速值（rclone 容量字符串，"off"/"" 表示不限）。rclone 的带宽
	// 限制器是进程全局的：运行期间 Ourboros 会把当前所有带限速任务的最小值
	// 应用到共享的 rclone 进程上，全部结束后恢复不限速。
	BWLimit string
	// MaxTransfer 单次同步大小上限（rclone 容量字符串，"off"/"" 表示不限）。
	// 通过 _config 按调用生效，按本任务自身的传输量计算。
	MaxTransfer string
	// Resync 仅对 bisync 有意义：执行重新初始化运行，建立两侧基线。
	Resync bool
}

type record struct {
	snapshot    Snapshot
	rcloneJobID *int64
	bwlimit     string
	// limitBytes 是单次大小上限（字节，0 表示不限）。rclone 自身的
	// MaxTransfer 检查对服务器端复制等路径不可靠，因此由轮询器按任务
	// 分组的统计字节在达到上限时主动 job/stop。
	limitBytes     int64
	limitDisplay   string
	limitTriggered bool
}

// maxFinishedJobs 限制已完成任务的保留数量，避免长期运行的实例无限累积快照。
const maxFinishedJobs = 100

type Store struct {
	mu           sync.Mutex
	jobs         map[string]*record
	runningEdges map[string]struct{}
	events       *events.Bus
	ctx          context.Context
	// rc 保存最近一次 Start/Stop 传入的 supervisor，用于在任务变化时调整
	// rclone 进程的全局限速。为 nil 时跳过限速管理（例如部分测试场景）。
	rc *rclone.Supervisor
	// appliedBwLimit 记录当前已应用到 rclone 的限速值，避免重复下发相同设置。
	appliedBwLimit string
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

func (s *Store) Start(rc *rclone.Supervisor, ws *workspace.Store, taskID string, operation workspace.Operation, source, target paths.Locator, opts Options) (Snapshot, error) {
	s.mu.Lock()
	if _, ok := s.runningEdges[taskID]; ok {
		s.mu.Unlock()
		return Snapshot{}, core.Conflict("task " + taskID + " already has a running job")
	}
	if rc != nil {
		s.rc = rc
	}
	id := uuid.NewString()
	snapshot := Snapshot{
		ID:          id,
		EdgeID:      taskID,
		Operation:   operation,
		Status:      StatusRunning,
		Destructive: operation.Destructive(),
		Impact:      operation.Impact(source.Display(), target.Display()),
		Source:      source,
		Target:      target,
		StartedAt:   time.Now().UTC(),
	}
	s.runningEdges[taskID] = struct{}{}
	limitBytes, limitDisplay := maxTransferLimit(opts)
	s.jobs[id] = &record{snapshot: snapshot, bwlimit: opts.BWLimit, limitBytes: limitBytes, limitDisplay: limitDisplay}
	s.mu.Unlock()
	s.emit(snapshot)
	s.reapplyBwLimit()

	body := buildJobBody(operation, source, target, opts, snapshot.ID)
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
	go s.pollUntilDone(rc, ws, id, taskID)
	return s.Get(id)
}

// normalizedLimit 把 "off" 归一为空串（不设置），其余原样返回。
func normalizedLimit(value string) string {
	if strings.EqualFold(strings.TrimSpace(value), "off") {
		return ""
	}
	return strings.TrimSpace(value)
}

// maxTransferLimit 解析单次大小上限，返回（字节数, 原始显示值）。0 表示无上限。
func maxTransferLimit(opts Options) (int64, string) {
	limit := normalizedLimit(opts.MaxTransfer)
	if limit == "" {
		return 0, ""
	}
	bytes, err := workspace.ParseSize(limit)
	if err != nil || bytes <= 0 {
		return 0, ""
	}
	return bytes, limit
}

// buildJobBody 构造 RC 请求体。单向命令使用 srcFs/dstFs；双向同步使用
// path1/path2 并按需携带 resync。MaxTransfer 通过 _config 只对本次调用生效，
// 硬停止模式下按任务自身的传输量计算。
func buildJobBody(operation workspace.Operation, source, target paths.Locator, opts Options, group string) map[string]any {
	body := map[string]any{
		"_async": true,
		"_group": group,
	}
	if operation.TwoWay() {
		body["path1"] = source.CombinedFS()
		body["path2"] = target.CombinedFS()
		if opts.Resync {
			body["resync"] = true
		}
	} else {
		body["srcFs"] = source.CombinedFS()
		body["dstFs"] = target.CombinedFS()
	}
	config := map[string]any{}
	if maxTransfer := normalizedLimit(opts.MaxTransfer); maxTransfer != "" {
		config["MaxTransfer"] = maxTransfer
		config["CutoffMode"] = "HARD"
	}
	if len(config) > 0 {
		body["_config"] = config
	}
	return body
}

// reapplyBwLimit 计算当前所有运行中任务的限速最小值并应用到共享 rclone 进程。
// 没有带限速的任务时恢复为不限速。网络调用放在锁外，失败只记录日志。
func (s *Store) reapplyBwLimit() {
	s.mu.Lock()
	if s.rc == nil {
		s.mu.Unlock()
		return
	}
	var active []string
	for _, record := range s.jobs {
		if record.snapshot.Status.Terminal() {
			continue
		}
		if limit := normalizedLimit(record.bwlimit); limit != "" {
			active = append(active, limit)
		}
	}
	desired := minBwLimit(active)
	if desired == s.appliedBwLimit {
		s.mu.Unlock()
		return
	}
	s.appliedBwLimit = desired
	rc := s.rc
	s.mu.Unlock()

	rate := "off"
	if desired != "" {
		rate = desired
	}
	if _, err := rc.CallInternal(s.ctx, "core/bwlimit", map[string]any{"rate": rate}); err != nil {
		slog.Warn("failed to apply bandwidth limit", "rate", rate, "err", err)
	}
}

// minBwLimit 返回多个限速值中最小的一个（按字节数比较），空列表返回 ""。
// rclone 的带宽限制器是进程全局的，多个任务并发运行时取最小值才能保证
// 每个任务的限速都不被超过。
func minBwLimit(values []string) string {
	desired := ""
	var desiredBytes int64
	for _, value := range values {
		limit := normalizedLimit(value)
		if limit == "" {
			continue
		}
		bytes, err := workspace.ParseSize(limit)
		if err != nil {
			continue
		}
		if desired == "" || bytes < desiredBytes {
			desired = limit
			desiredBytes = bytes
		}
	}
	return desired
}

// cancelWait 是 job/stop 之后等待 rclone 真正收尾（poller 观察到 job/status
// finished）的最长时间。超时后按取消兜底收尾并释放边锁。
const cancelWait = 5 * time.Second

func (s *Store) Stop(rc *rclone.Supervisor, jobID string) (Snapshot, error) {
	s.mu.Lock()
	if rc != nil {
		s.rc = rc
	}
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
		record, ok = s.jobs[jobID]
		if !ok || record.snapshot.Status.Terminal() {
			s.mu.Unlock()
			return
		}
		record.snapshot.Progress = progress
		snapshot := record.snapshot
		// 单次大小上限：rclone 对部分路径（例如服务器端复制）不会执行
		// MaxTransfer 中止，这里按任务自身的统计字节兜底强制停止。
		triggerLimit := record.limitBytes > 0 && !record.limitTriggered && progress.Bytes >= uint64(record.limitBytes)
		if triggerLimit {
			record.limitTriggered = true
			message := "max transfer limit reached: " + record.limitDisplay
			record.snapshot.Status = StatusCancelling
			record.snapshot.Error = &message
			snapshot = record.snapshot
		}
		s.mu.Unlock()

		if triggerLimit && rcloneJobID != nil {
			_, _ = rc.CallInternal(s.ctx, "job/stop", map[string]any{"jobid": *rcloneJobID})
		}
		s.emit(snapshot)

		if finished {
			// 瞬时完成的任务（例如本地之间的服务器端复制）可能在首次统计
			// 前就结束，结束时再补读一次分组统计，避免快照显示 0 字节。
			if progress.Bytes == 0 {
				if stats, err := rc.CallInternal(s.ctx, "core/stats", map[string]any{"group": jobID}); err == nil && stats.OK() {
					if parsed := parseStats(stats.Body); parsed.Bytes > 0 {
						progress = parsed
					}
				}
			}
			// 达到单次大小上限被 Ourboros 主动停止的任务按失败收尾，
			// 并覆盖错误信息，避免显示成普通的取消。
			s.mu.Lock()
			limitTriggered := false
			limitDisplay := ""
			if record, ok := s.jobs[jobID]; ok {
				limitTriggered = record.limitTriggered
				limitDisplay = record.limitDisplay
			}
			s.mu.Unlock()
			if limitTriggered {
				message := "max transfer limit reached: " + limitDisplay
				snapshot, err := s.finish(jobID, edgeID, StatusFailed, &message, &progress)
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
	s.reapplyBwLimit()
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
