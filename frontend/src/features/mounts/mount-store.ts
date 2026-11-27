import { create } from "zustand"

import { endpointLabel } from "@/features/sync/labels"
import i18n from "@/i18n"
import { call, callQuiet } from "@/lib/http/client"
import { openEventSource, parseEventPayload } from "@/lib/http/sse"
import type { MountSnapshot, MountTask, TaskEndpoint } from "@/lib/types"

export type MountInput = {
  name: string
  source: TaskEndpoint
  target: TaskEndpoint
}

type MountState = {
  revision: number
  mounts: MountTask[]
  snapshots: MountSnapshot[]
  loaded: boolean
  error: string | null
  load: () => Promise<void>
  loadSnapshots: () => Promise<void>
  createMount: (input: MountInput) => Promise<MountTask | null>
  deleteMount: (id: string) => Promise<void>
  startMount: (id: string) => Promise<MountSnapshot>
  stopMount: (id: string) => Promise<MountSnapshot>
}

function sortKey(mount: MountTask): string {
  return mount.name.trim() || endpointLabel(mount.target)
}

function upsertSnapshot(
  list: MountSnapshot[],
  next: MountSnapshot
): MountSnapshot[] {
  const index = list.findIndex((item) => item.edge_id === next.edge_id)
  if (index === -1) {
    return [...list, next]
  }
  const copy = list.slice()
  copy[index] = next
  return copy
}

/**
 * 挂载规则的服务端快照。写操作按 revision 串行提交，
 * 冲突或失败时回拉服务端最新列表。运行状态另走快照 + SSE。
 */
export const useMountStore = create<MountState>()((set, get) => {
  let queue: Promise<void> = Promise.resolve()

  const commit = (
    request: () => Promise<{ task: MountTask; revision?: number }>
  ): Promise<MountTask | null> => {
    let result: MountTask | null = null
    const run = async (): Promise<void> => {
      try {
        const response = await request()
        result = response.task
        set((state) => {
          const mounts = state.mounts.some(
            (item) => item.id === response.task.id
          )
            ? state.mounts.map((item) =>
                item.id === response.task.id ? response.task : item
              )
            : [...state.mounts, response.task]
          return {
            mounts: [...mounts].sort((a, b) =>
              sortKey(a).localeCompare(sortKey(b))
            ),
            revision: response.revision ?? state.revision,
            loaded: true,
            error: null,
          }
        })
      } catch {
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
    mounts: [],
    snapshots: [],
    loaded: false,
    error: null,

    load: async () => {
      try {
        const data = await callQuiet<{ tasks: MountTask[]; revision: number }>(
          "/api/mounts/tasks"
        )
        set({
          mounts: [...data.tasks].sort((a, b) =>
            sortKey(a).localeCompare(sortKey(b))
          ),
          revision: data.revision,
          loaded: true,
          error: null,
        })
      } catch (cause) {
        set({
          loaded: true,
          error:
            cause instanceof Error
              ? cause.message
              : i18n.t("errors.loadFailed"),
        })
      }
    },

    loadSnapshots: async () => {
      try {
        const data = await callQuiet<{ mounts: MountSnapshot[] }>("/api/mounts")
        set({ snapshots: data.mounts })
      } catch {
        set({ snapshots: [] })
      }
    },

    createMount: (input) => {
      return commit(() =>
        call<{ task: MountTask; revision: number }>("/api/mounts/tasks", {
          method: "POST",
          body: { revision: get().revision, ...input },
        })
      )
    },

    deleteMount: async (id) => {
      try {
        await call(
          `/api/mounts/tasks/${encodeURIComponent(id)}?revision=${get().revision}`,
          { method: "DELETE" }
        )
      } catch (error) {
        await get().load()
        throw error
      }
      await get().load()
    },

    startMount: async (id) => {
      const snapshot = await call<MountSnapshot>(
        `/api/mounts/${encodeURIComponent(id)}/start`,
        { method: "POST", body: {} }
      )
      set({ snapshots: upsertSnapshot(get().snapshots, snapshot) })
      return snapshot
    },

    stopMount: async (id) => {
      const snapshot = await call<MountSnapshot>(
        `/api/mounts/${encodeURIComponent(id)}/stop`,
        { method: "POST", body: {} }
      )
      set({ snapshots: upsertSnapshot(get().snapshots, snapshot) })
      return snapshot
    },
  }
})

/** 订阅挂载状态 SSE，返回取消订阅函数。 */
export function subscribeMounts(): () => void {
  void useMountStore.getState().loadSnapshots()
  return openEventSource(
    "/api/mounts/events",
    (_name, raw) => {
      const snapshot = parseEventPayload<MountSnapshot>(raw)
      if (snapshot) {
        useMountStore.setState({
          snapshots: upsertSnapshot(
            useMountStore.getState().snapshots,
            snapshot
          ),
        })
      } else {
        void useMountStore.getState().loadSnapshots()
      }
    },
    undefined,
    () => void useMountStore.getState().loadSnapshots()
  )
}
