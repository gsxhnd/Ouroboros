package jobs

import (
	"log/slog"

	"github.com/gsxhnd/ourboros/internal/units"
)

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
		bytes, err := units.ParseSize(limit)
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
