import { useCallback, useEffect, useState } from "react"
import { PlusIcon, RefreshCcwIcon, TrashIcon } from "lucide-react"
import { toast } from "sonner"

import {
  EmptyHint,
  SelectField,
  StatusChip,
  SwitchField,
} from "@/components/shared"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { call, callQuiet, errorMessage, formatBytes } from "@/lib/client"
import { openEventSource, parseEventPayload } from "@/lib/api"
import { useWorkspace } from "@/lib/workspace-hook"
import type {
  JobSnapshot,
  NodeKind,
  RemoteInfo,
  SyncOperation,
} from "@/lib/types"

type NodeForm = {
  kind: NodeKind
  label: string
  localPath: string
  remoteName: string
  remotePath: string
}

type EdgeForm = {
  source: string
  target: string
  operation: SyncOperation
  schedule: "manual" | "hourly" | "daily" | "weekly"
  enabled: boolean
}

const EMPTY_NODE: NodeForm = {
  kind: "local",
  label: "",
  localPath: "",
  remoteName: "",
  remotePath: "",
}

const EMPTY_EDGE: EdgeForm = {
  source: "",
  target: "",
  operation: "copy",
  schedule: "manual",
  enabled: true,
}

const TERMINAL = new Set([
  "succeeded",
  "failed",
  "partial_failed",
  "cancelled",
  "expired",
])

/** “最近完成”列表保留的条数。 */
const RECENT_LIMIT = 10

/** 合并一条任务快照（按 id），保持按开始时间倒序。 */
function upsertJob(list: JobSnapshot[], next: JobSnapshot): JobSnapshot[] {
  const index = list.findIndex((job) => job.id === next.id)
  if (index === -1) {
    return [next, ...list].sort((a, b) =>
      b.started_at.localeCompare(a.started_at)
    )
  }
  const copy = list.slice()
  copy[index] = next
  return copy
}

export function TransfersPage() {
  const { doc, reload } = useWorkspace()
  const [jobs, setJobs] = useState<JobSnapshot[]>([])
  const [remotes, setRemotes] = useState<RemoteInfo[]>([])
  const [nodeOpen, setNodeOpen] = useState(false)
  const [edgeOpen, setEdgeOpen] = useState(false)
  const [nodeForm, setNodeForm] = useState<NodeForm>(EMPTY_NODE)
  const [edgeForm, setEdgeForm] = useState<EdgeForm>(EMPTY_EDGE)

  const loadJobs = useCallback(async () => {
    try {
      const data = await callQuiet<{ jobs: JobSnapshot[] }>("/api/sync/jobs")
      setJobs(data.jobs)
    } catch {
      setJobs([])
    }
  }, [])

  const loadRemotes = useCallback(async () => {
    try {
      const data = await callQuiet<{ remotes: RemoteInfo[] }>("/api/remotes")
      setRemotes(data.remotes)
    } catch {
      setRemotes([])
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      await Promise.all([loadJobs(), loadRemotes()])
    }
    void run()
    // 进度事件很频繁，直接合并快照而不是每次都重新请求列表。
    return openEventSource(
      "/api/sync/jobs/events",
      (_name, raw) => {
        const snapshot = parseEventPayload<JobSnapshot>(raw)
        if (snapshot) {
          setJobs((current) => upsertJob(current, snapshot))
        } else {
          void loadJobs()
        }
      },
      undefined,
      // 断线重连后用一次快照补齐期间错过的事件。
      () => void loadJobs()
    )
  }, [loadJobs, loadRemotes])

  const nodeLabel = (id: string) => {
    const node = doc?.nodes.find((item) => item.id === id)
    if (!node) {
      return id
    }
    return node.kind === "local"
      ? node.label
      : `${node.label} (${node.remote?.name})`
  }

  const submitNode = async () => {
    const label = nodeForm.label.trim()
    if (!label) {
      toast.error("请填写名称")
      return
    }
    const body: Record<string, unknown> = {
      revision: doc?.revision,
      kind: nodeForm.kind,
      label,
      position: { x: 0, y: doc ? doc.nodes.length * 24 : 0 },
    }
    if (nodeForm.kind === "local") {
      const path = nodeForm.localPath.trim()
      if (!path) {
        toast.error("本地节点需要路径")
        return
      }
      body.local_path = path
    } else {
      if (!nodeForm.remoteName) {
        toast.error("远程节点需要 remote 名称")
        return
      }
      body.remote = {
        name: nodeForm.remoteName,
        path: nodeForm.remotePath.trim(),
      }
    }
    await call("/api/workspace/nodes", { method: "POST", body })
    toast.success(`已添加节点 ${label}`)
    setNodeOpen(false)
    setNodeForm(EMPTY_NODE)
    await reload()
  }

  const deleteNode = async (id: string) => {
    if (!doc) {
      return
    }
    if (!window.confirm(`删除节点 ${nodeLabel(id)}？连接它的边也会被删除。`)) {
      return
    }
    await call(
      `/api/workspace/nodes/${encodeURIComponent(id)}?revision=${doc.revision}`,
      {
        method: "DELETE",
      }
    )
    toast.success("已删除节点")
    await reload()
  }

  const submitEdge = async () => {
    if (!doc) {
      return
    }
    if (!edgeForm.source || !edgeForm.target) {
      toast.error("请选择起点和终点")
      return
    }
    if (edgeForm.source === edgeForm.target) {
      toast.error("起点和终点不能相同")
      return
    }
    await call("/api/workspace/edges", {
      method: "POST",
      body: {
        revision: doc.revision,
        source: edgeForm.source,
        target: edgeForm.target,
        kind: "sync",
        operation: edgeForm.operation,
        schedule: {
          mode: "preset",
          preset: edgeForm.schedule === "manual" ? "daily" : edgeForm.schedule,
          timezone: "UTC",
          enabled: edgeForm.schedule !== "manual",
        },
        enabled: edgeForm.enabled,
      },
    })
    toast.success("已创建同步连接")
    setEdgeOpen(false)
    setEdgeForm(EMPTY_EDGE)
    await reload()
  }

  const toggleEdge = async (edge: { id: string; enabled?: boolean }) => {
    if (!doc) {
      return
    }
    await call(`/api/workspace/edges/${encodeURIComponent(edge.id)}`, {
      method: "PATCH",
      body: { revision: doc.revision, enabled: !edge.enabled },
    })
    await reload()
  }

  const deleteEdge = async (id: string) => {
    if (!doc) {
      return
    }
    if (!window.confirm("删除这条同步连接？")) {
      return
    }
    await call(
      `/api/workspace/edges/${encodeURIComponent(id)}?revision=${doc.revision}`,
      {
        method: "DELETE",
      }
    )
    toast.success("已删除连接")
    await reload()
  }

  const runEdge = async (id: string) => {
    const snapshot = await call<JobSnapshot>(
      `/api/sync/${encodeURIComponent(id)}/run`,
      { method: "POST", body: {} }
    )
    toast.success(`已启动任务 ${snapshot.id.slice(0, 8)}`)
    await loadJobs()
  }

  const stopJob = async (jobId: string) => {
    await call(`/api/sync/jobs/${encodeURIComponent(jobId)}/stop`, {
      method: "POST",
      body: {},
    })
    await loadJobs()
  }

  const edges = doc?.edges.filter((edge) => edge.kind === "sync") ?? []
  const canRun = Boolean(doc?.nodes.length)
  const runningJobs = jobs.filter((job) => !TERMINAL.has(job.status))
  const recentJobs = jobs
    .filter((job) => TERMINAL.has(job.status))
    .slice(0, RECENT_LIMIT)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle>存储节点</CardTitle>
              <CardDescription>
                同步和挂载连接的两端。这是列表视图，不涉及画布。
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void reload()}>
                <RefreshCcwIcon />
              </Button>
              <Button size="sm" onClick={() => setNodeOpen(true)}>
                <PlusIcon /> 添加节点
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(doc?.nodes.length ?? 0) === 0 ? (
            <EmptyHint>还没有节点，先添加本地目录或 remote。</EmptyHint>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-1 py-2 font-medium">名称</th>
                  <th className="px-1 py-2 font-medium">类型</th>
                  <th className="px-1 py-2 font-medium">位置</th>
                  <th className="px-1 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {doc?.nodes.map((node) => (
                  <tr key={node.id} className="border-b last:border-b-0">
                    <td className="px-1 py-2 font-medium">{node.label}</td>
                    <td className="px-1 py-2">
                      <Badge variant="outline">{node.kind}</Badge>
                    </td>
                    <td className="px-1 py-2 font-mono text-xs text-muted-foreground">
                      {node.kind === "local"
                        ? node.local_path
                        : `${node.remote?.name}${node.remote?.path ? `/${node.remote.path}` : ""}`}
                    </td>
                    <td className="px-1 py-2">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="删除节点"
                        onClick={() => void deleteNode(node.id)}
                      >
                        <TrashIcon />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle>同步连接</CardTitle>
              <CardDescription>
                点"立即执行"跑一次 copy / move / sync；也可以开启定时。
              </CardDescription>
            </div>
            <Button
              size="sm"
              disabled={!canRun}
              onClick={() => setEdgeOpen(true)}
            >
              <PlusIcon /> 新建连接
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {edges.length === 0 ? (
            <EmptyHint>还没有同步连接。</EmptyHint>
          ) : (
            edges.map((edge) => {
              const sync = edge.sync
              return (
                <div
                  key={edge.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{nodeLabel(edge.source)}</span>
                  <span className="text-xs text-muted-foreground">
                    {sync?.operation ?? "copy"} →
                  </span>
                  <span className="font-medium">{nodeLabel(edge.target)}</span>
                  <Badge variant={sync?.enabled ? "default" : "outline"}>
                    {sync?.enabled ? "已启用" : "已禁用"}
                  </Badge>
                  {sync?.schedule?.enabled ? (
                    <Badge variant="secondary">{sync.schedule.preset}</Badge>
                  ) : null}
                  {sync?.last_result ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      上次 <StatusChip status={sync.last_result.status} />
                    </span>
                  ) : null}
                  <div className="ms-auto flex gap-1.5">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        void toggleEdge({ id: edge.id, enabled: sync?.enabled })
                      }
                    >
                      {sync?.enabled ? "禁用" : "启用"}
                    </Button>
                    <Button
                      size="xs"
                      onClick={() => void runEdge(edge.id)}
                      disabled={!sync?.enabled}
                    >
                      立即执行
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="删除连接"
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

      <Card>
        <CardHeader>
          <CardTitle>运行中的任务</CardTitle>
          <CardDescription>
            进度实时推送；连接断开后会自动补齐。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {runningJobs.length === 0 ? (
            <EmptyHint>当前没有正在运行的任务。</EmptyHint>
          ) : (
            runningJobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onStop={() => void stopJob(job.id)}
              />
            ))
          )}
        </CardContent>
      </Card>

      {recentJobs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>最近完成</CardTitle>
            <CardDescription>
              最近 {RECENT_LIMIT} 条已结束的任务。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {recentJobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={nodeOpen} onOpenChange={setNodeOpen}>
        <DialogContent>
          <DialogHeader>添加节点</DialogHeader>
          <div className="flex flex-col gap-3">
            <SelectField
              label="类型"
              value={nodeForm.kind}
              options={[
                { value: "local", label: "本地目录" },
                { value: "remote", label: "远程 remote" },
              ]}
              onChange={(kind) =>
                setNodeForm((current) => ({ ...current, kind }))
              }
            />
            <div className="flex flex-col gap-1.5">
              <Label>名称</Label>
              <Input
                value={nodeForm.label}
                placeholder="备份盘"
                onChange={(e) =>
                  setNodeForm((current) => ({
                    ...current,
                    label: e.target.value,
                  }))
                }
              />
            </div>
            {nodeForm.kind === "local" ? (
              <div className="flex flex-col gap-1.5">
                <Label>本地路径</Label>
                <Input
                  value={nodeForm.localPath}
                  placeholder="/absolute/path(以 /、~ 开头)"
                  className="font-mono"
                  onChange={(e) =>
                    setNodeForm((current) => ({
                      ...current,
                      localPath: e.target.value,
                    }))
                  }
                />
              </div>
            ) : (
              <>
                <SelectField
                  label="remote"
                  value={nodeForm.remoteName}
                  options={remotes.map((r) => ({
                    value: r.name,
                    label: r.name,
                  }))}
                  onChange={(name) =>
                    setNodeForm((current) => ({ ...current, remoteName: name }))
                  }
                  disabled={remotes.length === 0}
                  placeholder={
                    remotes.length === 0
                      ? "先在 rclone 中创建 remote"
                      : undefined
                  }
                />
                <div className="flex flex-col gap-1.5">
                  <Label>remote 内路径（可选）</Label>
                  <Input
                    value={nodeForm.remotePath}
                    placeholder="backup/photos"
                    className="font-mono"
                    onChange={(e) =>
                      setNodeForm((current) => ({
                        ...current,
                        remotePath: e.target.value,
                      }))
                    }
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              取消
            </DialogClose>
            <Button onClick={() => void submitNode()}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={edgeOpen} onOpenChange={setEdgeOpen}>
        <DialogContent>
          <DialogHeader>新建同步连接</DialogHeader>
          <div className="flex flex-col gap-3">
            <SelectField
              label="起点（源）"
              value={edgeForm.source}
              options={(doc?.nodes ?? []).map((node) => ({
                value: node.id,
                label: node.label,
              }))}
              onChange={(source) =>
                setEdgeForm((current) => ({ ...current, source }))
              }
              placeholder="选择节点"
            />
            <SelectField
              label="终点（目标）"
              value={edgeForm.target}
              options={(doc?.nodes ?? []).map((node) => ({
                value: node.id,
                label: node.label,
              }))}
              onChange={(target) =>
                setEdgeForm((current) => ({ ...current, target }))
              }
              placeholder="选择节点"
            />
            <SelectField
              label="操作"
              value={edgeForm.operation}
              options={[
                { value: "copy", label: "copy（复制）" },
                { value: "move", label: "move（移动，删除源）" },
                { value: "sync", label: "sync（镜像，可能删除目标文件）" },
              ]}
              onChange={(operation) =>
                setEdgeForm((current) => ({ ...current, operation }))
              }
            />
            <SelectField
              label="定时"
              value={edgeForm.schedule}
              options={[
                { value: "manual", label: "手动" },
                { value: "hourly", label: "每小时" },
                { value: "daily", label: "每天" },
                { value: "weekly", label: "每周" },
              ]}
              onChange={(schedule) =>
                setEdgeForm((current) => ({ ...current, schedule }))
              }
            />
            <SwitchField
              label="默认启用"
              checked={edgeForm.enabled}
              onCheckedChange={(enabled) =>
                setEdgeForm((current) => ({ ...current, enabled }))
              }
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              取消
            </DialogClose>
            <Button
              onClick={() =>
                void submitEdge().catch((error: unknown) =>
                  toast.error(
                    error instanceof Error ? error.message : errorMessage(null)
                  )
                )
              }
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

const OPERATION_LABEL: Record<string, string> = {
  copy: "复制",
  move: "移动",
  sync: "同步",
}

/** 与后端 paths.Locator.CombinedFS 的拼接规则保持一致。 */
function locatorText(locator: Record<string, unknown>): string {
  const fs = String(locator.fs ?? "")
  const remote = String(locator.remote ?? "").replace(/^\/+/, "")
  if (!remote) {
    return fs
  }
  if (locator.kind === "local") {
    return `${fs.replace(/[\\/]+$/, "")}/${remote}`
  }
  return `${fs}${remote}`
}

function JobRow({ job, onStop }: { job: JobSnapshot; onStop?: () => void }) {
  const percentage = job.progress.percentage
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
      <StatusChip status={job.status} />
      <Badge variant="outline">
        {OPERATION_LABEL[job.operation] ?? job.operation}
      </Badge>
      <span
        className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground"
        title={job.impact}
      >
        {locatorText(job.source)} → {locatorText(job.target)}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatBytes(job.progress.bytes)}
        {percentage > 0 ? ` · ${percentage.toFixed(0)}%` : ""}
        {` · ${job.progress.transfers} 个传输`}
        {job.progress.errors > 0 ? ` · ${job.progress.errors} 个错误` : ""}
      </span>
      <div className="ms-auto flex items-center gap-1.5">
        {onStop ? (
          <Button
            size="xs"
            variant="outline"
            disabled={job.status === "cancelling"}
            onClick={onStop}
          >
            停止
          </Button>
        ) : null}
        {job.error ? (
          <span
            className="max-w-xs truncate text-xs text-destructive"
            title={job.error}
          >
            {job.error}
          </span>
        ) : null}
      </div>
    </div>
  )
}
