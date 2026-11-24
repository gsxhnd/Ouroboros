import { create } from "zustand"

import { call, callQuiet } from "@/lib/client"
import type { ConnectionEdge, RemoteInfo, StorageNode } from "@/lib/types"

type StorageState = {
  revision: number
  nodes: StorageNode[]
  edges: ConnectionEdge[]
  remotes: RemoteInfo[]
  loaded: boolean
  error: string | null
  load: () => Promise<void>
  createLocal: (input: { label: string; local_path: string }) => Promise<void>
  deleteLocal: (id: string) => Promise<void>
  deleteRemote: (name: string) => Promise<void>
}

/**
 * 存储页的服务端快照：本地目录来自 workspace 节点（同步任务按路径复用），
 * remote 来自 rclone 配置。写操作按 revision 串行提交，冲突或失败回拉快照。
 */
export const useStorageStore = create<StorageState>()((set, get) => {
  let queue: Promise<void> = Promise.resolve()

  const commit = (request: () => Promise<void>): Promise<void> => {
    const run = async () => {
      try {
        await request()
        await get().load()
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
    remotes: [],
    loaded: false,
    error: null,

    load: async () => {
      try {
        const [doc, remotesData] = await Promise.all([
          callQuiet<{
            revision: number
            nodes: StorageNode[]
            edges: ConnectionEdge[]
          }>("/api/workspace"),
          callQuiet<{ remotes: RemoteInfo[] }>("/api/remotes").catch(() => ({
            remotes: [] as RemoteInfo[],
          })),
        ])
        set({
          revision: doc.revision,
          nodes: doc.nodes,
          edges: doc.edges,
          remotes: remotesData.remotes,
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

    createLocal: (input) => {
      return commit(async () => {
        await call("/api/workspace/nodes", {
          method: "POST",
          body: {
            revision: get().revision,
            kind: "local",
            label: input.label,
            position: { x: 0, y: 0 },
            local_path: input.local_path,
          },
        })
      })
    },

    deleteLocal: (id) => {
      return commit(async () => {
        await call(
          `/api/workspace/nodes/${encodeURIComponent(id)}?revision=${get().revision}`,
          {
            method: "DELETE",
          }
        )
      })
    },

    deleteRemote: (name) => {
      return commit(async () => {
        await call(`/api/remotes/${encodeURIComponent(name)}`, {
          method: "DELETE",
        })
      })
    },
  }
})
