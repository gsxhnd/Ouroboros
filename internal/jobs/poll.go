package jobs

import (
	"time"
)

const pollInterval = 500 * time.Millisecond

// pollUntilDone follows one rclone job until it reaches a terminal state,
// publishing progress on every pass and handing the final snapshot to the
// onFinish callback.
func (s *Store) pollUntilDone(jobID, edgeID string) {
	for {
		select {
		case <-s.ctx.Done():
			return
		case <-time.After(pollInterval):
		}
		s.mu.Lock()
		record, ok := s.jobs[jobID]
		if !ok || record.snapshot.Status.Terminal() {
			s.mu.Unlock()
			return
		}
		rcloneJobID := record.rcloneJobID
		s.mu.Unlock()

		if !s.rc.Status().Running {
			s.expire(jobID, edgeID)
			return
		}

		observed, unavailable := s.observe(jobID, rcloneJobID)
		if unavailable {
			s.expire(jobID, edgeID)
			return
		}
		if !s.publishProgress(jobID, rcloneJobID, observed.progress) {
			return
		}
		if observed.finished {
			s.complete(jobID, edgeID, observed)
			return
		}
	}
}

// observation is what one poll learned about a job from rclone.
type observation struct {
	progress Progress
	finished bool
	success  bool
	err      *string
}

// observe asks rclone for the job's grouped stats and, once rclone has
// assigned the job an ID, its status. unavailable reports that rclone went
// away during the check.
func (s *Store) observe(jobID string, rcloneJobID *int64) (observed observation, unavailable bool) {
	if stats, err := s.rc.CallInternal(s.ctx, "core/stats", map[string]any{"group": jobID, "short": true}); err == nil && stats.OK() {
		observed.progress = parseStats(stats.Body)
	}
	if rcloneJobID == nil {
		return observed, false
	}
	response, err := s.rc.CallInternal(s.ctx, "job/status", map[string]any{"jobid": *rcloneJobID})
	if err != nil || !response.OK() {
		return observed, !s.rc.Status().Running
	}
	observed.finished, _ = response.Body["finished"].(bool)
	observed.success, _ = response.Body["success"].(bool)
	if message, ok := response.Body["error"].(string); ok && message != "" {
		observed.err = &message
	}
	if raw, ok := response.Body["progress"].(map[string]any); ok {
		mergeProgress(&observed.progress, raw)
	}
	return observed, false
}

// expire ends a job whose rclone process disappeared.
func (s *Store) expire(jobID, edgeID string) {
	message := "rclone became unavailable"
	_, _ = s.finish(jobID, edgeID, StatusExpired, &message, nil)
}

// publishProgress stores and emits the latest progress. It also enforces the
// per-job transfer cap: rclone does not abort MaxTransfer for some paths
// (for example server-side copies), so once the job's own byte count reaches
// the cap it is stopped here. It returns false when the job is already gone or
// terminal and polling should end.
func (s *Store) publishProgress(jobID string, rcloneJobID *int64, progress Progress) bool {
	s.mu.Lock()
	record, ok := s.jobs[jobID]
	if !ok || record.snapshot.Status.Terminal() {
		s.mu.Unlock()
		return false
	}
	record.snapshot.Progress = progress
	snapshot := record.snapshot
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
		_, _ = s.rc.CallInternal(s.ctx, "job/stop", map[string]any{"jobid": *rcloneJobID})
	}
	s.emit(snapshot)
	return true
}

// complete moves a finished job to its terminal status and reports it.
func (s *Store) complete(jobID, edgeID string, observed observation) {
	progress := observed.progress
	// 瞬时完成的任务（例如本地之间的服务器端复制）可能在首次统计
	// 前就结束，结束时再补读一次分组统计，避免快照显示 0 字节。
	if progress.Bytes == 0 {
		if stats, err := s.rc.CallInternal(s.ctx, "core/stats", map[string]any{"group": jobID}); err == nil && stats.OK() {
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
		s.finishAndNotify(jobID, edgeID, StatusFailed, &message, &progress)
		return
	}

	status := StatusSucceeded
	if !observed.success {
		status = StatusFailed
	} else if progress.Errors > 0 {
		status = StatusPartialFailed
	}
	jobErr := observed.err
	if final := reconcileCancel(s.currentStatus(jobID), status); final != status {
		status = final
		jobErr = nil
	}
	s.finishAndNotify(jobID, edgeID, status, jobErr, &progress)
}

func (s *Store) finishAndNotify(jobID, edgeID string, status Status, message *string, progress *Progress) {
	snapshot, err := s.finish(jobID, edgeID, status, message, progress)
	if err == nil {
		s.notifyFinished(edgeID, snapshot)
	}
}
