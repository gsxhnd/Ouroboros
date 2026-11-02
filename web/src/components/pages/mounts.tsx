import { useCallback, useEffect, useState } from "react"
import { PlusIcon, RefreshCcwIcon, TrashIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyHint, SelectField, StatusChip } from "@/components/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { call, callQuiet } from "@/lib/client"
import { openEventSource, parseEventPayload } from "@/lib/api"
import { useWorkspace } from "@/lib/workspace-hook"
import type { MountSnapshot, StorageNode } from "@/lib/types"

/** 正在启动或卸载中，此时不允许再次点击。 */
const IN_FLIGHT: ReadonlySet<string> = new Set(["starting", "stopping"])
/** 已经挂载或正在挂载，按钮应显示为“卸载”。 */
const ATTACHED: ReadonlySet<string> = new Set([
  "mounted",
  "starting",
  "stopping",
])

export function MountsPage() {
  const { doc, reload } = useWorkspace()
  const [mounts, setMounts] = useState<MountSnapshot[]>([])
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set())
  const [open, setOpen] = useState(false)
  const [sourceId, setSourceId] = useState("")
  const [targetId, setTargetId] = useState("")

  const loadMounts = useCallback(async () => {
    try {
      const data = await callQuiet<{ mounts: MountSnapshot[] }>("/api/mounts")
      setMounts(data.mounts)
    } catch {
      setMounts([])
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      await loadMounts()
    }
    void run()
    // 每条事件就是该挂载的最新快照，直接合并即可，无需重新拉取整张列表。
    return openEventSource(
      "/api/mounts/events",
      (_name, raw) => {
        const snapshot = parseEventPayload<MountSnapshot>(raw)
        if (!snapshot) {
          void loadMounts()
          return
        }
        setMounts((current) => upsertMount(current, snapshot))
      },
      undefined,
      () => void loadMounts()
    )
  }, [loadMounts])

  const remoteNodes = (doc?.nodes ?? []).filter(
    (node) => node.kind === "remote"
  )
  const localNodes = (doc?.nodes ?? []).filter((node) => node.kind === "local")
  const mountEdges = doc?.edges.filter((edge) => edge.kind === "mount") ?? []
  const mountOf = (edgeId: string) => mounts.find((m) => m.edge_id === edgeId)
  const canCreate = remoteNodes.length > 0 && localNodes.length > 0

  const withPending = async (edgeId: string, action: () => Promise<void>) => {
    setPending((current) => new Set(current).add(edgeId))
    try {
      await action()
    } finally {
      setPending((current) => {
        const next = new Set(current)
        next.delete(edgeId)
        return next
      })
    }
  }

  const start = (edgeId: string) =>
    withPending(edgeId, async () => {
      try {
        const snapshot = await call<MountSnapshot>(
          `/api/mounts/${encodeURIComponent(edgeId)}/start`,
          { method: "POST", body: {} }
        )
        if (snapshot.status === "failed") {
          toast.error("挂载失败", { description: snapshot.error })
        } else {
          toast.success("挂载已启动")
        }
        setMounts((current) => upsertMount(current, snapshot))
      } catch {
        // call() 已经弹出错误提示。
      }
    })

  const stop = (edgeId: string) =>
    withPending(edgeId, async () => {
      try {
        const snapshot = await call<MountSnapshot>(
          `/api/mounts/${encodeURIComponent(edgeId)}/stop`,
          { method: "POST", body: {} }
        )
        setMounts((current) => upsertMount(current, snapshot))
      } catch {
        // call() 已经弹出错误提示。
      }
    })

  const createMountEdge = async () => {
    if (!doc) {
      return
    }
    if (!sourceId || !targetId) {
      toast.error("请选择 remote 节点与本地节点")
      return
    }
    try {
      await call("/api/workspace/edges", {
        method: "POST",
        body: {
          revision: doc.revision,
          source: sourceId,
          target: targetId,
          kind: "mount",
          enabled: true,
        },
      })
    } catch {
      return
    }
    toast.success("已创建挂载连接，点“挂载”把它挂到本地目录")
    setOpen(false)
    setSourceId("")
    setTargetId("")
    await reload()
  }

  const deleteEdge = async (edgeId: string) => {
    if (!doc) {
      return
    }
    if (!window.confirm("删除这条挂载连接？")) {
      return
    }
    try {
      await call(
        `/api/workspace/edges/${encodeURIComponent(edgeId)}?revision=${doc.revision}`,
        { method: "DELETE" }
      )
    } catch {
      return
    }
    await reload()
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle>挂载连接</CardTitle>
              <CardDescription>
                把 remote 挂载到本地目录，方向必须是 remote → 本地目录。
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                aria-label="刷新挂载状态"
                onClick={() => {
                  void reload()
                  void loadMounts()
                }}
              >
                <RefreshCcwIcon />
              </Button>
              <Button
                size="sm"
                disabled={!canCreate}
                onClick={() => setOpen(true)}
              >
                <PlusIcon /> 新建挂载
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {mountEdges.length === 0 ? (
            <EmptyHint>
              还没有挂载连接。需要先有一个 remote
              节点和一个本地目录节点（可在“同步任务”页添加）。
            </EmptyHint>
          ) : (
            mountEdges.map((edge) => {
              const mount = mountOf(edge.id)
              const status = mount?.status ?? "stopped"
              const attached = ATTACHED.has(status)
              const busy = pending.has(edge.id) || IN_FLIGHT.has(status)
              const sourceNode = findNode(doc?.nodes ?? [], edge.source)
              const targetNode = findNode(doc?.nodes ?? [], edge.target)
              return (
                <div
                  key={edge.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <Badge variant="outline">
                    {sourceNode?.label ?? edge.source}
                  </Badge>
                  <span className="text-xs text-muted-foreground" aria-hidden>
                    →
                  </span>
                  <Badge variant="outline" className="font-mono font-normal">
                    {targetNode ? localPathOf(targetNode) : edge.target}
                  </Badge>
                  <StatusChip status={status} />
                  {mount?.error ? (
                    <span
                      className="min-w-0 basis-full truncate text-xs text-destructive"
                      title={mount.error}
                    >
                      {mount.error}
                    </span>
                  ) : null}
                  <div className="ms-auto flex gap-1.5">
                    {attached ? (
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void stop(edge.id)}
                      >
                        卸载
                      </Button>
                    ) : (
                      <Button
                        size="xs"
                        disabled={busy}
                        onClick={() => void start(edge.id)}
                      >
                        挂载
                      </Button>
                    )}
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="删除挂载连接"
                      disabled={attached}
                      onClick={() => void deleteEdge(edge.id)}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>新建挂载连接</DialogHeader>
          <div className="flex flex-col gap-3">
            <SelectField
              label="remote 节点（源）"
              value={sourceId}
              options={remoteNodes.map((node) => ({
                value: node.id,
                label: node.label,
              }))}
              onChange={setSourceId}
              placeholder="选择 remote 节点"
            />
            <SelectField
              label="本地节点（目标目录）"
              value={targetId}
              options={localNodes.map((node) => ({
                value: node.id,
                label: node.label,
              }))}
              onChange={setTargetId}
              placeholder="选择本地节点"
            />
            {!canCreate ? (
              <p className="text-xs text-destructive">
                需要先在“同步任务”页添加一个 remote 节点和一个本地目录节点。
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              取消
            </DialogClose>
            <Button onClick={() => void createMountEdge()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function upsertMount(
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

function findNode(nodes: StorageNode[], id: string) {
  return nodes.find((node) => node.id === id)
}

function localPathOf(node: StorageNode) {
  return node.local_path ?? node.label
}
