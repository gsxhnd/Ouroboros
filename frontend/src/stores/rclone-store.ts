import { create } from "zustand"

import { call, callQuiet } from "@/lib/client"
import type { RcloneStatus } from "@/lib/types"

type RcloneState = {
  /** rclone 当前状态；为 null 表示 Ourboros 服务本身不可达。 */
  status: RcloneStatus | null
  /** 启动 / 停止请求进行中。 */
  busy: boolean
  refresh: () => Promise<void>
  start: () => Promise<void>
  stop: () => Promise<void>
}

/**
 * Single source of truth for rclone status. The shell polls it once and every
 * page reads from here, instead of each page polling on its own.
 */
export const useRcloneStore = create<RcloneState>()((set, get) => {
  const transition = async (path: string) => {
    set({ busy: true })
    try {
      const next = await call<RcloneStatus>(path, { method: "POST", body: {} })
      set({ status: next })
    } catch {
      // call() 已经弹出错误提示，这里只需要恢复状态。
    } finally {
      set({ busy: false })
      void get().refresh()
    }
  }

  return {
    status: null,
    busy: false,
    refresh: async () => {
      try {
        set({ status: await callQuiet<RcloneStatus>("/api/rclone/status") })
      } catch {
        set({ status: null })
      }
    },
    start: () => transition("/api/rclone/start"),
    stop: () => transition("/api/rclone/stop"),
  }
})

/** 启动后台轮询，返回停止函数。在应用外壳挂载时调用一次。 */
export function startRcloneStatusPolling(intervalMs = 4000): () => void {
  const { refresh } = useRcloneStore.getState()
  void refresh()
  const timer = window.setInterval(() => void refresh(), intervalMs)
  return () => window.clearInterval(timer)
}
