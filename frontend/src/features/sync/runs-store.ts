import { create } from "zustand"

import { callQuiet } from "@/lib/http/client"
import type { SyncRun } from "@/lib/types"

type RunsState = {
  /** 每个任务最近一次执行的记录，key 是 task_id；任务页概览使用。 */
  latest: Record<string, SyncRun>
  loaded: boolean
  loadLatest: () => Promise<void>
}

/**
 * 同步执行历史（bbolt）的前端快照。
 * 任务列表页只需要“每个任务最近一次执行”，分页列表留在详情页内。
 */
export const useRunsStore = create<RunsState>()((set) => ({
  latest: {},
  loaded: false,
  loadLatest: async () => {
    try {
      const data = await callQuiet<{ runs: SyncRun[] }>("/api/sync/runs/latest")
      const latest: Record<string, SyncRun> = {}
      for (const run of data.runs ?? []) {
        latest[run.task_id] = run
      }
      set({ latest, loaded: true })
    } catch {
      // 历史库不可用（例如打开失败降级）时不打扰用户，概览回退到 last_result。
      set({ loaded: true })
    }
  },
}))
