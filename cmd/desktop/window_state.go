package main

import (
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/gsxhnd/ourboros/internal/persist"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// windowState 记录主窗口的几何位置，跨启动恢复用户拖好的大小与位置。
// 只持久化普通窗口的 x/y/w/h：最大化 / 全屏属于展示状态，交给各系统的
// 默认行为；尺寸记忆覆盖用户实际拖出来的窗口大小。
type windowState struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

func windowStatePath() string {
	return filepath.Join(persist.DefaultDataDir(), "window-state.json")
}

// loadWindowState 读取上次保存的窗口状态；缺失、损坏或尺寸低于窗口最小值
// 时返回 nil，让调用方走默认尺寸。
func loadWindowState(minWidth, minHeight int) *windowState {
	raw, err := os.ReadFile(windowStatePath())
	if err != nil {
		return nil
	}
	var state windowState
	if err := json.Unmarshal(raw, &state); err != nil {
		slog.Warn("ignoring invalid window state", "err", err)
		return nil
	}
	if state.Width < minWidth || state.Height < minHeight {
		return nil
	}
	return &state
}

// saveWindowState 把当前窗口几何写盘（临时文件 + rename 的原子写，与
// workspace / settings 的持久化同约定）。移动 / 缩放事件在拖动过程中会
// 连续触发，单次写入只有几十字节，直接写即可；这样任何退出路径（托盘
// 退出、Cmd+Q、关窗隐藏）都不会丢最后一次调整。
func saveWindowState(win *application.WebviewWindow) {
	x, y := win.Position()
	width, height := win.Size()
	raw, err := json.Marshal(windowState{X: x, Y: y, Width: width, Height: height})
	if err != nil {
		return
	}
	if err := persist.AtomicWrite(windowStatePath(), raw); err != nil {
		slog.Warn("failed to save window state", "err", err)
	}
}
