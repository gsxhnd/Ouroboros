import { create } from "zustand"

import { call, callQuiet } from "@/lib/client"
import { openEventSource, parseEventPayload } from "@/lib/api"
import type { JobSnapshot, SyncTask, TaskEndpoint } from "@/lib/types"

export type SchedulePreset = "manual" | "hourly" | "daily" | "weekly"

export type SyncTaskInput = {
  name: string
  source: TaskEndpoint
  target: TaskEndpoint
  operation: "copy" | "move" | "sync" | "bisync"
  bw_limit?: string
  max_transfer?: string
  schedule: {
    mode: string
    preset?: string
    cron?: string
    timezone: string
    enabled: boolean
  }
  enabled: boolean
}

type SyncState = {
  revision: number
  tasks: SyncTask[]
  loaded: boolean
  error: string | null
  jobs: JobSnapshot[]
  load: () => Promise<void>
  createTask: (input: SyncTaskInput) => Promise<SyncTask | null>
  patchTask: (
    id: string,
    values: Partial<SyncTaskInput>
  ) => Promise<SyncTask | null>
  deleteTask: (id: string) => Promise<void>
  runTask: (id: string, options?: { resync?: boolean }) => Promise<void>
  stopJob: (id: string) => Promise<void>
  loadJobs: () => Promise<void>
}

export const TERMINAL_JOB_STATUSES = new Set([
  "succeeded",
  "failed",
  "partial_failed",
  "cancelled",
  "expired",
])

/** 用户本地时区；后端 schedule 支持任意 IANA 时区，不必硬编码 UTC。 */
const LOCAL_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

/** 把面板上的计划预设转成后端 schedule 结构。 */
export function scheduleFor(preset: SchedulePreset) {
  return {
    mode: "preset",
    preset: preset === "manual" ? "daily" : preset,
    timezone: LOCAL_TIMEZONE,
    enabled: preset !== "manual",
  }
}

export function upsertJob(
  list: JobSnapshot[],
  next: JobSnapshot
): JobSnapshot[] {
  const index = list.findIndex((job) => job.id === next.id)
  if (index === -1) {
    return [next, ...list]
  }
  const copy = list.slice()
  copy[index] = next
  return copy
}

/**
 * 同步任务的服务端快照。写操作按 revision 串行提交，
 * 冲突或失败时回拉服务端最新快照。
 */
export const useSyncStore = create<SyncState>()((set, get) => {
  // 服务端按 revision 严格比较，写操作必须串行，否则连续提交会互相冲突。
  let queue: Promise<void> = Promise.resolve()

  const commit = (
    request: () => Promise<{ task: SyncTask; revision?: number }>
  ): Promise<SyncTask | null> => {
    let result: SyncTask | null = null
    const run = async (): Promise<void> => {
      try {
        const response = await request()
        result = response.task
        set((state) => {
          const tasks = state.tasks.some((task) => task.id === response.task.id)
            ? state.tasks.map((task) =>
                task.id === response.task.id ? response.task : task
              )
            : [...state.tasks, response.task]
          return {
            tasks: [...tasks].sort((a, b) => a.name.localeCompare(b.name)),
            revision: response.revision ?? state.revision,
            loaded: true,
            error: null,
          }
        })
      } catch {
        // call() 已经弹出错误提示；回滚到服务端最新快照。
        await get().load()
      }
    }
    const promise = queue.then(run, run).then(() => result)
    queue = promise.then(
      () => undefined,
      () => undefined
    )
    return promise
  }

  return {
    revision: 0,
    tasks: [],
    loaded: false,
    error: null,
    jobs: [],

    load: async () => {
      try {
        const data = await callQuiet<{ tasks: SyncTask[]; revision: number }>(
          "/api/sync/tasks"
        )
        set({
          tasks: [...data.tasks].sort((a, b) => a.name.localeCompare(b.name)),
          revision: data.revision,
          loaded: true,
          error: null,
        })
      } catch (cause) {
        set({
          loaded: true,
          error: cause instanceof Error ? cause.message : "load failed",
        })
      }
    },

    createTask: (input) => {
      return commit(() =>
        call<{ task: SyncTask }>("/api/sync/tasks", {
          method: "POST",
          body: { revision: get().revision, ...input },
        })
      )
    },

    patchTask: (id, values) => {
      return commit(() =>
        call<{ task: SyncTask }>(`/api/sync/tasks/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: { revision: get().revision, ...values },
        })
      )
    },

    deleteTask: async (id) => {
      await call<{ revision: number }>(
        `/api/sync/tasks/${encodeURIComponent(id)}?revision=${get().revision}`,
        { method: "DELETE" }
      )
      await get().load()
    },

    runTask: async (id, options) => {
      const snapshot = await call<JobSnapshot>(
        `/api/sync/tasks/${encodeURIComponent(id)}/run`,
        {
          method: "POST",
          body: { resync: options?.resync === true },
        }
      )
      set({ jobs: upsertJob(get().jobs, snapshot) })
    },

    stopJob: async (id) => {
      await call(`/api/sync/jobs/${encodeURIComponent(id)}/stop`, {
        method: "POST",
        body: {},
      })
      await get().loadJobs()
    },

    loadJobs: async () => {
      try {
        const data = await callQuiet<{ jobs: JobSnapshot[] }>("/api/sync/jobs")
        set({ jobs: data.jobs })
      } catch {
        set({ jobs: [] })
      }
    },
  }
})

/** 订阅同步任务的 SSE 事件，返回取消订阅函数。 */
export function subscribeSyncJobs(): () => void {
  const store = useSyncStore.getState()
  void store.loadJobs()
  return openEventSource(
    "/api/sync/jobs/events",
    (_name, raw) => {
      const snapshot = parseEventPayload<JobSnapshot>(raw)
      if (snapshot) {
        useSyncStore.setState({
          jobs: upsertJob(useSyncStore.getState().jobs, snapshot),
        })
      } else {
        void useSyncStore.getState().loadJobs()
      }
    },
    undefined,
    () => void useSyncStore.getState().loadJobs()
  )
}
