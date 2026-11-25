package jobs

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/events"
	"github.com/gsxhnd/ourboros/internal/rclone"
)

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
	// rc 是共享的 rclone supervisor，用于下发任务与调整进程全局限速。
	rc *rclone.Supervisor
	// onFinish 在任务以终态收尾后被调用，把结果交给调用方持久化。可为 nil。
	onFinish FinishFunc
	// appliedBwLimit 记录当前已应用到 rclone 的限速值，避免重复下发相同设置。
	appliedBwLimit string
}

// FinishFunc receives a job's final snapshot. The scheduler's persistence
// lives behind it so this package never writes to the workspace itself.
type FinishFunc func(edgeID string, snapshot Snapshot)

// New builds a Store that talks to rc. onFinish may be nil.
func New(ctx context.Context, bus *events.Bus, rc *rclone.Supervisor, onFinish FinishFunc) *Store {
	if ctx == nil {
		ctx = context.Background()
	}
	return &Store{
		rc:           rc,
		onFinish:     onFinish,
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

func (s *Store) notifyFinished(edgeID string, snapshot Snapshot) {
	if s.onFinish != nil {
		s.onFinish(edgeID, snapshot)
	}
}

func (s *Store) emit(snapshot Snapshot) {
	if s.events != nil {
		s.events.Publish(events.NameJob, snapshot)
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
