// Package history 把同步任务的每次执行记录持久化到本地 bbolt 数据库。
//
// 存储布局：单一 runs 桶，key 为 "<task_id>/<20 位纳秒时间戳>/<run_id>"。
// 纳秒时间戳定宽后字节序即时间序，因此按任务前缀扫描天然按开始时间排序，
// 倒序遍历即"最新在前"，无需二级索引。
//
// 历史属于增强功能：打开失败或未配置路径时 Store 为 nil，所有方法都是
// 安全空操作，绝不影响同步任务本身（与 rclone 缺失时的降级策略一致）。
package history

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	bolt "go.etcd.io/bbolt"
)

var bucketRuns = []byte("runs")

// maxRunsPerTask 每个任务保留的执行记录上限，超过时淘汰最旧的记录，
// 与内存任务快照的保留策略（jobs.maxFinishedJobs）对齐。
const maxRunsPerTask = 100

// 运行状态。running 表示进行中；interrupted 只在服务重启修复时出现，
// 表示进程未能观察到该次运行的结局。
const (
	StatusRunning       = "running"
	StatusSucceeded     = "succeeded"
	StatusFailed        = "failed"
	StatusPartialFailed = "partial_failed"
	StatusCancelled     = "cancelled"
	StatusExpired       = "expired"
	StatusInterrupted   = "interrupted"
)

// RunStats 是一次运行的最终统计，来自任务分组 core/stats 的末次快照。
type RunStats struct {
	Bytes      uint64  `json:"bytes"`
	Transfers  uint64  `json:"transfers"`
	Checks     uint64  `json:"checks"`
	Errors     uint64  `json:"errors"`
	Percentage float64 `json:"percentage"`
	Speed      float64 `json:"speed"`
}

// Run 记录一次同步任务的执行。ID 与 job id 一致，Trigger 说明触发来源。
type Run struct {
	ID         string     `json:"id"`
	TaskID     string     `json:"task_id"`
	Operation  string     `json:"operation"`
	Source     Locator    `json:"source"`
	Target     Locator    `json:"target"`
	Trigger    string     `json:"trigger"`
	Status     string     `json:"status"`
	StartedAt  time.Time  `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
	Error      string     `json:"error,omitempty"`
	Stats      *RunStats  `json:"stats,omitempty"`
}

// Locator 是运行记录里源/目标端点的 JSON 形式，与 paths.Locator 及
// 前端 JobLocator 保持一致，避免历史包反向依赖其他内部包。
type Locator struct {
	Kind   string `json:"kind"`
	FS     string `json:"fs"`
	Remote string `json:"remote"`
}

// FinishInput 汇总一次运行收尾所需的全部字段。
type FinishInput struct {
	TaskID     string
	RunID      string
	StartedAt  time.Time
	Status     string
	Error      string
	FinishedAt time.Time
	Stats      *RunStats
}

// Store 包装 bbolt 数据库。零值与 nil 的 Store 都是安全空操作。
type Store struct {
	db *bolt.DB
}

// Open 打开（必要时创建）历史数据库并修复遗留的 running 记录：
// 上个进程未能观察到结局的运行统一标记为 interrupted。
func Open(path string) (*Store, error) {
	db, err := bolt.Open(path, 0o600, &bolt.Options{Timeout: 2 * time.Second})
	if err != nil {
		return nil, err
	}
	err = db.Update(func(tx *bolt.Tx) error {
		b, err := tx.CreateBucketIfNotExists(bucketRuns)
		if err != nil {
			return err
		}
		return repairInterrupted(b)
	})
	if err != nil {
		_ = db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

// Close 关闭数据库；nil Store 与重复关闭都是安全的。
func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

// Start 写入一次运行的开头记录（状态 running）。调用方在任务真正启动后
// 调用；记录失败只影响历史完整性，由调用方记日志决定是否忽略。
func (s *Store) Start(run Run) error {
	if s == nil || s.db == nil {
		return nil
	}
	raw, err := json.Marshal(run)
	if err != nil {
		return err
	}
	return s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketRuns)
		if b == nil {
			return nil
		}
		if err := b.Put(runKey(run.TaskID, run.StartedAt, run.ID), raw); err != nil {
			return err
		}
		return pruneTask(b, run.TaskID)
	})
}

// Finish 把运行置为终态并写入最终统计。找不到开头记录时静默跳过：
// 例如历史库启动失败期间从未写入 Start。
func (s *Store) Finish(in FinishInput) error {
	if s == nil || s.db == nil {
		return nil
	}
	key := runKey(in.TaskID, in.StartedAt, in.RunID)
	return s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketRuns)
		if b == nil {
			return nil
		}
		raw := b.Get(key)
		if raw == nil {
			return nil
		}
		var run Run
		if err := json.Unmarshal(raw, &run); err != nil {
			return err
		}
		finishedAt := in.FinishedAt
		run.Status = in.Status
		run.Error = in.Error
		run.FinishedAt = &finishedAt
		run.Stats = in.Stats
		updated, err := json.Marshal(run)
		if err != nil {
			return err
		}
		if err := b.Put(key, updated); err != nil {
			return err
		}
		return pruneTask(b, in.TaskID)
	})
}

// List 按开始时间倒序返回某任务的执行记录，total 为该任务的记录总数。
// limit 为 0 表示返回全部。
func (s *Store) List(taskID string, limit, offset int) ([]Run, int, error) {
	runs, err := s.listAll(taskID)
	if err != nil || runs == nil {
		return []Run{}, 0, err
	}
	total := len(runs)
	if offset < 0 {
		offset = 0
	}
	if offset > total {
		offset = total
	}
	runs = runs[offset:]
	if limit > 0 && limit < len(runs) {
		runs = runs[:limit]
	}
	return runs, total, nil
}

// listAll 按时间倒序取出某任务的全部记录。nil Store 返回 nil 表示无历史。
func (s *Store) listAll(taskID string) ([]Run, error) {
	if s == nil || s.db == nil {
		return nil, nil
	}
	var runs []Run
	err := s.db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketRuns)
		if b == nil {
			return nil
		}
		prefix := []byte(taskID + "/")
		c := b.Cursor()
		for k, v := c.Seek(prefix); k != nil && bytes.HasPrefix(k, prefix); k, v = c.Next() {
			var run Run
			if err := json.Unmarshal(v, &run); err != nil {
				continue
			}
			runs = append(runs, run)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	// 前缀扫描是升序，倒序即最新在前。
	sort.Slice(runs, func(i, j int) bool { return runs[i].StartedAt.After(runs[j].StartedAt) })
	if runs == nil {
		runs = []Run{}
	}
	return runs, nil
}

// LatestByTask 返回每个任务最新的一条记录，按开始时间倒序。
// key 按时间升序遍历，同一任务后出现的覆盖先出现的，即保留最新。
func (s *Store) LatestByTask() ([]Run, error) {
	if s == nil || s.db == nil {
		return []Run{}, nil
	}
	latest := map[string]Run{}
	err := s.db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketRuns)
		if b == nil {
			return nil
		}
		return b.ForEach(func(_ []byte, v []byte) error {
			var run Run
			if err := json.Unmarshal(v, &run); err != nil {
				return nil
			}
			latest[run.TaskID] = run
			return nil
		})
	})
	if err != nil {
		return nil, err
	}
	runs := make([]Run, 0, len(latest))
	for _, run := range latest {
		runs = append(runs, run)
	}
	sort.Slice(runs, func(i, j int) bool { return runs[i].StartedAt.After(runs[j].StartedAt) })
	return runs, nil
}

// DeleteTask 删除某任务的全部记录，在同步任务被删除时调用。
func (s *Store) DeleteTask(taskID string) error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket(bucketRuns)
		if b == nil {
			return nil
		}
		prefix := []byte(taskID + "/")
		c := b.Cursor()
		var keys [][]byte
		for k, _ := c.Seek(prefix); k != nil && bytes.HasPrefix(k, prefix); k, _ = c.Next() {
			keys = append(keys, append([]byte(nil), k...))
		}
		for _, k := range keys {
			if err := b.Delete(k); err != nil {
				return err
			}
		}
		return nil
	})
}

// runKey 构造记录 key：任务前缀 + 定宽纳秒时间戳 + 运行 ID。
// 定宽保证字节序与时间序一致；纳秒粒度内的同刻运行由 runID 兜底。
func runKey(taskID string, startedAt time.Time, runID string) []byte {
	return []byte(taskID + "/" + fmt.Sprintf("%020d", startedAt.UnixNano()) + "/" + runID)
}

// pruneTask 把单个任务的记录数裁剪到 maxRunsPerTask 以内。
func pruneTask(b *bolt.Bucket, taskID string) error {
	prefix := []byte(taskID + "/")
	c := b.Cursor()
	var keys [][]byte
	for k, _ := c.Seek(prefix); k != nil && bytes.HasPrefix(k, prefix); k, _ = c.Next() {
		keys = append(keys, append([]byte(nil), k...))
	}
	if len(keys) <= maxRunsPerTask {
		return nil
	}
	for _, k := range keys[:len(keys)-maxRunsPerTask] {
		if err := b.Delete(k); err != nil {
			return err
		}
	}
	return nil
}

// repairInterrupted 把启动时仍处于 running 的记录标记为 interrupted：
// 这些运行属于上个进程，其真实结局已不可知。改写会打断游标，
// 因此先收集再统一写回。
func repairInterrupted(b *bolt.Bucket) error {
	type fixup struct {
		key   []byte
		value []byte
	}
	var pending []fixup
	c := b.Cursor()
	for k, v := c.First(); k != nil; k, v = c.Next() {
		var run Run
		if json.Unmarshal(v, &run) != nil || run.Status != StatusRunning {
			continue
		}
		now := time.Now().UTC()
		run.Status = StatusInterrupted
		run.FinishedAt = &now
		run.Error = "service restarted before the run finished"
		value, err := json.Marshal(run)
		if err != nil {
			return err
		}
		pending = append(pending, fixup{key: append([]byte(nil), k...), value: value})
	}
	for _, item := range pending {
		if err := b.Put(item.key, item.value); err != nil {
			return err
		}
	}
	return nil
}
