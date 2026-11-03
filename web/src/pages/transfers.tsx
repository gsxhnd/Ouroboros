import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
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
import { useWorkspace } from "@/stores/workspace"
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
  const { t } = useTranslation()
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
      toast.error(t("transfers.needName"))
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
        toast.error(t("transfers.localNeedsPath"))
        return
      }
      body.local_path = path
    } else {
      if (!nodeForm.remoteName) {
        toast.error(t("transfers.remoteNeedsName"))
        return
      }
      body.remote = {
        name: nodeForm.remoteName,
        path: nodeForm.remotePath.trim(),
      }
    }
    await call("/api/workspace/nodes", { method: "POST", body })
    toast.success(t("transfers.nodeAdded", { name: label }))
    setNodeOpen(false)
    setNodeForm(EMPTY_NODE)
    await reload()
  }

  const deleteNode = async (id: string) => {
    if (!doc) {
      return
    }
    if (!window.confirm(t("transfers.deleteNodeConfirm", { name: nodeLabel(id) }))) {
      return
    }
    await call(
      `/api/workspace/nodes/${encodeURIComponent(id)}?revision=${doc.revision}`,
      {
        method: "DELETE",
      }
    )
    toast.success(t("transfers.nodeDeleted"))
    await reload()
  }

  const submitEdge = async () => {
    if (!doc) {
      return
    }
    if (!edgeForm.source || !edgeForm.target) {
      toast.error(t("transfers.needEnds"))
      return
    }
    if (edgeForm.source === edgeForm.target) {
      toast.error(t("transfers.sameEnds"))
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
    toast.success(t("transfers.edgeCreated"))
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
    if (!window.confirm(t("transfers.deleteEdgeConfirm"))) {
      return
    }
    await call(
      `/api/workspace/edges/${encodeURIComponent(id)}?revision=${doc.revision}`,
      {
        method: "DELETE",
      }
    )
    toast.success(t("transfers.edgeDeleted"))
    await reload()
  }

  const runEdge = async (id: string) => {
    const snapshot = await call<JobSnapshot>(
      `/api/sync/${encodeURIComponent(id)}/run`,
      { method: "POST", body: {} }
    )
    toast.success(t("transfers.jobStarted", { id: snapshot.id.slice(0, 8) }))
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
              <CardTitle>{t("transfers.nodesTitle")}</CardTitle>
              <CardDescription>{t("transfers.nodesDescription")}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void reload()}>
                <RefreshCcwIcon />
              </Button>
              <Button size="sm" onClick={() => setNodeOpen(true)}>
                <PlusIcon /> {t("transfers.addNode")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(doc?.nodes.length ?? 0) === 0 ? (
            <EmptyHint>{t("transfers.nodesEmpty")}</EmptyHint>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-1 py-2 font-medium">{t("common.name")}</th>
                  <th className="px-1 py-2 font-medium">{t("common.type")}</th>
                  <th className="px-1 py-2 font-medium">{t("transfers.columnLocation")}</th>
                  <th className="px-1 py-2 font-medium">{t("common.actions")}</th>
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
                        aria-label={t("transfers.ariaDeleteNode")}
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
              <CardTitle>{t("transfers.edgesTitle")}</CardTitle>
              <CardDescription>{t("transfers.edgesDescription")}</CardDescription>
            </div>
            <Button
              size="sm"
              disabled={!canRun}
              onClick={() => setEdgeOpen(true)}
            >
              <PlusIcon /> {t("transfers.newEdge")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {edges.length === 0 ? (
            <EmptyHint>{t("transfers.edgesEmpty")}</EmptyHint>
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
                    {sync?.enabled ? t("transfers.enabled") : t("transfers.disabled")}
                  </Badge>
                  {sync?.schedule?.enabled ? (
                    <Badge variant="secondary">{sync.schedule.preset}</Badge>
                  ) : null}
                  {sync?.last_result ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {t("transfers.lastRun")} <StatusChip status={sync.last_result.status} />
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
                      {sync?.enabled ? t("transfers.disable") : t("transfers.enable")}
                    </Button>
                    <Button
                      size="xs"
                      onClick={() => void runEdge(edge.id)}
                      disabled={!sync?.enabled}
                    >
                      {t("transfers.runNow")}
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={t("transfers.ariaDeleteEdge")}
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
          <CardTitle>{t("transfers.jobsTitle")}</CardTitle>
          <CardDescription>{t("transfers.jobsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {runningJobs.length === 0 ? (
            <EmptyHint>{t("transfers.jobsEmpty")}</EmptyHint>
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
            <CardTitle>{t("transfers.recentTitle")}</CardTitle>
            <CardDescription>
              {t("transfers.recentDescription", { count: RECENT_LIMIT })}
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
          <DialogHeader>{t("transfers.addNode")}</DialogHeader>
          <div className="flex flex-col gap-3">
            <SelectField
              label={t("common.type")}
              value={nodeForm.kind}
              options={[
                { value: "local", label: t("transfers.kindLocal") },
                { value: "remote", label: t("transfers.kindRemote") },
              ]}
              onChange={(kind) =>
                setNodeForm((current) => ({ ...current, kind }))
              }
            />
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.name")}</Label>
              <Input
                value={nodeForm.label}
                placeholder={t("transfers.namePlaceholder")}
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
                <Label>{t("transfers.localPath")}</Label>
                <Input
                  value={nodeForm.localPath}
                  placeholder={t("transfers.localPathPlaceholder")}
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
                    remotes.length === 0 ? t("transfers.noRemotes") : undefined
                  }
                />
                <div className="flex flex-col gap-1.5">
                  <Label>{t("transfers.remotePath")}</Label>
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
              {t("common.cancel")}
            </DialogClose>
            <Button onClick={() => void submitNode()}>{t("common.add")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={edgeOpen} onOpenChange={setEdgeOpen}>
        <DialogContent>
          <DialogHeader>{t("transfers.edgeDialogTitle")}</DialogHeader>
          <div className="flex flex-col gap-3">
            <SelectField
              label={t("transfers.source")}
              value={edgeForm.source}
              options={(doc?.nodes ?? []).map((node) => ({
                value: node.id,
                label: node.label,
              }))}
              onChange={(source) =>
                setEdgeForm((current) => ({ ...current, source }))
              }
              placeholder={t("transfers.selectNode")}
            />
            <SelectField
              label={t("transfers.target")}
              value={edgeForm.target}
              options={(doc?.nodes ?? []).map((node) => ({
                value: node.id,
                label: node.label,
              }))}
              onChange={(target) =>
                setEdgeForm((current) => ({ ...current, target }))
              }
              placeholder={t("transfers.selectNode")}
            />
            <SelectField
              label={t("transfers.operation")}
              value={edgeForm.operation}
              options={[
                { value: "copy", label: t("transfers.opCopy") },
                { value: "move", label: t("transfers.opMove") },
                { value: "sync", label: t("transfers.opSync") },
              ]}
              onChange={(operation) =>
                setEdgeForm((current) => ({ ...current, operation }))
              }
            />
            <SelectField
              label={t("transfers.schedule")}
              value={edgeForm.schedule}
              options={[
                { value: "manual", label: t("transfers.scheduleManual") },
                { value: "hourly", label: t("transfers.scheduleHourly") },
                { value: "daily", label: t("transfers.scheduleDaily") },
                { value: "weekly", label: t("transfers.scheduleWeekly") },
              ]}
              onChange={(schedule) =>
                setEdgeForm((current) => ({ ...current, schedule }))
              }
            />
            <SwitchField
              label={t("transfers.defaultEnabled")}
              checked={edgeForm.enabled}
              onCheckedChange={(enabled) =>
                setEdgeForm((current) => ({ ...current, enabled }))
              }
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("common.cancel")}
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
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
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
  const { t, i18n } = useTranslation()
  const percentage = job.progress.percentage
  const opKey = `transfers.operationLabels.${job.operation}`
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
      <StatusChip status={job.status} />
      <Badge variant="outline">
        {i18n.exists(opKey) ? i18n.t(opKey) : job.operation}
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
        {` · ${t("transfers.jobTransfers", { count: job.progress.transfers })}`}
        {job.progress.errors > 0
          ? ` · ${t("transfers.jobErrors", { count: job.progress.errors })}`
          : ""}
      </span>
      <div className="ms-auto flex items-center gap-1.5">
        {onStop ? (
          <Button
            size="xs"
            variant="outline"
            disabled={job.status === "cancelling"}
            onClick={onStop}
          >
            {t("common.stop")}
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
