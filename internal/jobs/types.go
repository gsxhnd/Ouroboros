package jobs

import (
	"time"

	"github.com/gsxhnd/ourboros/internal/paths"
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
	Trigger     Trigger             `json:"trigger,omitempty"`
	Source      paths.Locator       `json:"source"`
	Target      paths.Locator       `json:"target"`
	Impact      string              `json:"impact"`
	Progress    Progress            `json:"progress"`
	Error       *string             `json:"error,omitempty"`
	StartedAt   time.Time           `json:"started_at"`
	FinishedAt  *time.Time          `json:"finished_at,omitempty"`
}

// Trigger 说明一次运行由谁触发，写入执行历史。
type Trigger string

const (
	TriggerManual    Trigger = "manual"
	TriggerScheduled Trigger = "scheduled"
)

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
	// Trigger 触发来源（手动 / 计划），随快照写入执行历史。
	Trigger Trigger
}
