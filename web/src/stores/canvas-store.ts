import { create } from "zustand"

import { call, callQuiet } from "@/lib/client"
import { openEventSource, parseEventPayload } from "@/lib/api"
import type {
  ConnectionEdge,
  EdgeKind,
  JobSnapshot,
  MountSnapshot,
  NodeKind,
  Position,
  RemoteRef,
  StorageNode,
  Viewport,
  WorkspaceDocument,
} from "@/lib/types"

export type SchedulePreset = "manual" | "hourly" | "daily" | "weekly"

export type EdgeSettings = {
  operation: "copy" | "move" | "sync"
  schedule: SchedulePreset
  enabled: boolean
}

export type NewNodeInput = {
  kind: NodeKind
  label: string
  position: Position
  local_path?: string
  remote?: RemoteRef
  action?: ActionSettings
}

export type ActionSettings = {
  operation: "copy" | "move" | "sync"
  schedule: SchedulePreset
  enabled: boolean
}

type CanvasState = {
  revision: number
  nodes: StorageNode[]
  edges: ConnectionEdge[]
  viewport: Viewport
  loaded: boolean
  error: string | null
  jobs: JobSnapshot[]
  mounts: MountSnapshot[]
  load: () => Promise<void>
  moveNode: (id: string, position: Position) => Promise<void>
  setViewport: (viewport: Viewport) => void
  saveViewport: () => Promise<void>
  createNode: (input: NewNodeInput) => Promise<StorageNode | null>
  renameNode: (id: string, label: string) => Promise<void>
  updateStorageNode: (
    id: string,
    values: { label: string; local_path?: string; remote?: RemoteRef }
  ) => Promise<void>
  deleteNode: (id: string) => Promise<void>
  createEdge: (source: string, target: string, kind?: EdgeKind) => Promise<void>
  updateAction: (id: string, settings: Partial<ActionSettings>) => Promise<void>
  runAction: (id: string) => Promise<void>
  updateEdge: (id: string, settings: Partial<EdgeSettings>) => Promise<void>
  deleteEdge: (id: string) => Promise<void>
  runEdge: (id: string) => Promise<void>
  stopJob: (id: string) => Promise<void>
  loadJobs: () => Promise<void>
  mountEdge: (id: string) => Promise<void>
  unmountEdge: (id: string) => Promise<void>
  loadMounts: () => Promise<void>
}

const EMPTY_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 }

export const TERMINAL_JOB_STATUSES = new Set([
  "succeeded",
  "failed",
  "partial_failed",
  "cancelled",
  "expired",
])

/** 与后端 Store 的节点/边结构一致，画布只在前端保存这一份快照。 */
function applyDocument(doc: WorkspaceDocument) {
  return {
    revision: doc.revision,
    nodes: doc.nodes,
    edges: doc.edges,
    viewport: doc.viewport ?? EMPTY_VIEWPORT,
    loaded: true,
    error: null,
  }
}

/** 用户本地时区；后端 schedule 支持任意 IANA 时区，不必硬编码 UTC。 */
const LOCAL_TIMEZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

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

export function upsertMount(
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
 * 画布的服务端快照与待保存状态。
 * 写操作按 revision 串行提交，冲突或失败时回拉服务端快照。
 */
export const useCanvasStore = create<CanvasState>()((set, get) => {
  // 服务端按 revision 严格比较，写操作必须串行，否则拖拽连续提交会互相冲突。
  let queue: Promise<void> = Promise.resolve()

  const commit = (request: () => Promise<WorkspaceDocument>): Promise<void> => {
    const run = async () => {
      try {
        set(applyDocument(await request()))
      } catch {
        // call() 已经弹出错误提示；回滚到服务端最新快照。
        await get().load()
      }
    }
    queue = queue.then(run, run)
    return queue
  }

  return {
    revision: 0,
    nodes: [],
    edges: [],
    viewport: EMPTY_VIEWPORT,
    loaded: false,
    error: null,
    jobs: [],
    mounts: [],

    load: async () => {
      try {
        set(applyDocument(await call<WorkspaceDocument>("/api/workspace")))
      } catch (cause) {
        set({
          loaded: true,
          error: cause instanceof Error ? cause.message : "load failed",
        })
      }
    },

    moveNode: async (id, position) => {
      set({
        nodes: get().nodes.map((item) =>
          item.id === id ? { ...item, position } : item
        ),
      })
      await commit(() =>
        call<WorkspaceDocument>(
          `/api/workspace/nodes/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            body: { revision: get().revision, position },
          }
        )
      )
    },

    setViewport: (viewport) => set({ viewport }),

    saveViewport: async () => {
      const { viewport } = get()
      await commit(() =>
        call<WorkspaceDocument>("/api/workspace", {
          method: "PUT",
          body: {
            revision: get().revision,
            nodes: get().nodes,
            edges: get().edges,
            viewport,
          },
        })
      )
    },

    createNode: async (input) => {
      const before = new Set(get().nodes.map((node) => node.id))
      await commit(() =>
        call<WorkspaceDocument>("/api/workspace/nodes", {
          method: "POST",
          body: {
            revision: get().revision,
            kind: input.kind,
            label: input.label,
            position: input.position,
            local_path: input.local_path ?? null,
            remote: input.remote ?? null,
            action: input.action
              ? {
                  operation: input.action.operation,
                  schedule: scheduleFor(input.action.schedule),
                  enabled: input.action.enabled,
                }
              : null,
          },
        })
      )
      return get().nodes.find((node) => !before.has(node.id)) ?? null
    },

    renameNode: async (id, label) => {
      await commit(() =>
        call<WorkspaceDocument>(
          `/api/workspace/nodes/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            body: { revision: get().revision, label },
          }
        )
      )
    },

    updateStorageNode: async (id, values) => {
      await commit(() =>
        call<WorkspaceDocument>(
          `/api/workspace/nodes/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            body: { revision: get().revision, ...values },
          }
        )
      )
    },

    deleteNode: async (id) => {
      await commit(() =>
        call<WorkspaceDocument>(
          `/api/workspace/nodes/${encodeURIComponent(id)}?revision=${get().revision}`,
          { method: "DELETE" }
        )
      )
    },

    createEdge: async (source, target, kind) => {
      const sourceNode = get().nodes.find((node) => node.id === source)
      const targetNode = get().nodes.find((node) => node.id === target)
      const touchesAction =
        sourceNode?.kind === "action" || targetNode?.kind === "action"
      const resolved: EdgeKind =
        kind ??
        (touchesAction
          ? "flow"
          : sourceNode?.kind === "remote" && targetNode?.kind === "local"
            ? "mount"
            : "sync")
      await commit(() =>
        call<WorkspaceDocument>("/api/workspace/edges", {
          method: "POST",
          body: {
            revision: get().revision,
            source,
            target,
            kind: resolved,
            ...(resolved === "sync"
              ? {
                  operation: "copy",
                  schedule: scheduleFor("manual"),
                  enabled: true,
                }
              : resolved === "mount"
                ? { enabled: true }
                : {}),
          },
        })
      )
    },

    updateEdge: async (id, settings) => {
      const edge = get().edges.find((item) => item.id === id)
      if (!edge) {
        return
      }
      const body: Record<string, unknown> = { revision: get().revision }
      if (edge.kind === "sync") {
        if (settings.operation) {
          body.operation = settings.operation
        }
        if (settings.schedule) {
          body.schedule = scheduleFor(settings.schedule)
        }
      }
      if (settings.enabled !== undefined) {
        body.enabled = settings.enabled
      }
      await commit(() =>
        call<WorkspaceDocument>(
          `/api/workspace/edges/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            body,
          }
        )
      )
    },

    deleteEdge: async (id) => {
      await commit(() =>
        call<WorkspaceDocument>(
          `/api/workspace/edges/${encodeURIComponent(id)}?revision=${get().revision}`,
          { method: "DELETE" }
        )
      )
    },

    updateAction: async (id, settings) => {
      const body: Record<string, unknown> = {}
      if (settings.operation) {
        body.operation = settings.operation
      }
      if (settings.schedule) {
        body.schedule = scheduleFor(settings.schedule)
      }
      if (settings.enabled !== undefined) {
        body.enabled = settings.enabled
      }
      await commit(() =>
        call<WorkspaceDocument>(
          `/api/workspace/nodes/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            body: { revision: get().revision, action: body },
          }
        )
      )
    },

    runAction: async (id) => {
      const snapshot = await call<JobSnapshot>(
        `/api/actions/${encodeURIComponent(id)}/run`,
        {
          method: "POST",
          body: {},
        }
      )
      set({ jobs: upsertJob(get().jobs, snapshot) })
    },

    runEdge: async (id) => {
      const snapshot = await call<JobSnapshot>(
        `/api/sync/${encodeURIComponent(id)}/run`,
        {
          method: "POST",
          body: {},
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

    mountEdge: async (id) => {
      const snapshot = await call<MountSnapshot>(
        `/api/mounts/${encodeURIComponent(id)}/start`,
        {
          method: "POST",
          body: {},
        }
      )
      set({ mounts: upsertMount(get().mounts, snapshot) })
    },

    unmountEdge: async (id) => {
      const snapshot = await call<MountSnapshot>(
        `/api/mounts/${encodeURIComponent(id)}/stop`,
        {
          method: "POST",
          body: {},
        }
      )
      set({ mounts: upsertMount(get().mounts, snapshot) })
    },

    loadMounts: async () => {
      try {
        const data = await callQuiet<{ mounts: MountSnapshot[] }>("/api/mounts")
        set({ mounts: data.mounts })
      } catch {
        set({ mounts: [] })
      }
    },
  }
})

/** 订阅任务和挂载的 SSE 事件，返回取消订阅函数。 */
export function subscribeRuntime(): () => void {
  const store = useCanvasStore.getState()
  void store.loadJobs()
  void store.loadMounts()
  const closeJobs = openEventSource(
    "/api/sync/jobs/events",
    (_name, raw) => {
      const snapshot = parseEventPayload<JobSnapshot>(raw)
      if (snapshot) {
        useCanvasStore.setState({
          jobs: upsertJob(useCanvasStore.getState().jobs, snapshot),
        })
      } else {
        void useCanvasStore.getState().loadJobs()
      }
    },
    undefined,
    () => void useCanvasStore.getState().loadJobs()
  )
  const closeMounts = openEventSource(
    "/api/mounts/events",
    (_name, raw) => {
      const snapshot = parseEventPayload<MountSnapshot>(raw)
      if (snapshot) {
        useCanvasStore.setState({
          mounts: upsertMount(useCanvasStore.getState().mounts, snapshot),
        })
      } else {
        void useCanvasStore.getState().loadMounts()
      }
    },
    undefined,
    () => void useCanvasStore.getState().loadMounts()
  )
  return () => {
    closeJobs()
    closeMounts()
  }
}
