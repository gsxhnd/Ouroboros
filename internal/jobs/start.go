package jobs

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gsxhnd/ourboros/internal/core"
	"github.com/gsxhnd/ourboros/internal/paths"
	"github.com/gsxhnd/ourboros/internal/units"
	"github.com/gsxhnd/ourboros/internal/workspace"
)

func (s *Store) Start(taskID string, operation workspace.Operation, source, target paths.Locator, opts Options) (Snapshot, error) {
	s.mu.Lock()
	if _, ok := s.runningEdges[taskID]; ok {
		s.mu.Unlock()
		return Snapshot{}, core.Conflict("task " + taskID + " already has a running job")
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
	response, err := s.rc.CallInternal(s.ctx, operation.RcloneCommand(), body)
	if err != nil {
		s.fail(id, err.Error())
		return Snapshot{}, err
	}
	if !response.OK() {
		message := response.ErrorMessage("rclone job failed")
		s.fail(id, message)
		return Snapshot{}, core.Upstream(message)
	}
	if jobID, ok := asInt64(response.Body["jobid"]); ok {
		s.mu.Lock()
		if record, exists := s.jobs[id]; exists {
			record.rcloneJobID = &jobID
		}
		s.mu.Unlock()
	}
	go s.pollUntilDone(id, taskID)
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
	bytes, err := units.ParseSize(limit)
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
