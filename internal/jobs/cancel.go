package jobs

import (
	"time"

	"github.com/gsxhnd/ourboros/internal/core"
)

// cancelWait 是 job/stop 之后等待 rclone 真正收尾（poller 观察到 job/status
// finished）的最长时间。超时后按取消兜底收尾并释放边锁。
const cancelWait = 5 * time.Second

func (s *Store) Stop(jobID string) (Snapshot, error) {
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
		_, _ = s.rc.CallInternal(s.ctx, "job/stop", map[string]any{"jobid": *rcloneJobID})
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
