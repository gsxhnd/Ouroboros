import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ArrowRightIcon,
  ClockIcon,
  GaugeIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RefreshCcwIcon,
  SquareIcon,
  TrashIcon,
} from "lucide-react"
import { toast } from "sonner"

import { TaskDialog } from "@/components/sync/task-dialog"
import { EmptyHint, StatusChip, SwitchField } from "@/components/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { call, formatBytes, formatTime } from "@/lib/client"
import type { JobLocator, JobSnapshot, RemoteInfo, SyncTask } from "@/lib/types"
import {
  TERMINAL_JOB_STATUSES,
  subscribeSyncJobs,
  useSyncStore,
} from "@/stores/sync-store"
import { useRcloneStore } from "@/stores/rclone-store"

type RunConfirm = { task: SyncTask }

/** 单向同步的操作徽标文案。 */
function operationLabel(task: SyncTask, t: (key: string) => string): string {
  switch (task.operation) {
    case "bisync":
      return t("sync.opBisync")
    case "copy":
      return t("sync.opCopy")
    case "move":
      return t("sync.opMove")
    default:
      return t("sync.opSync")
  }
}

function scheduleLabel(task: SyncTask, t: (key: string) => string): string {
  const schedule = task.schedule
  if (!schedule?.enabled) {
    return t("sync.scheduleManual")
  }
  if (schedule.mode === "cron") {
    return `${t("sync.scheduleCron")} · ${schedule.cron ?? ""}`
  }
  switch (schedule.preset) {
    case "hourly":
      return t("sync.scheduleHourly")
    case "weekly":
      return t("sync.scheduleWeekly")
    default:
      return t("sync.scheduleDaily")
  }
}

/** 双向同步是否需要先执行 resync 初始化。 */
function bisyncNeedsResync(task: SyncTask): boolean {
  return task.operation === "bisync" && task.last_result?.status !== "succeeded"
}

export function SyncPage() {
  const { t } = useTranslation()
  const tasks = useSyncStore((state) => state.tasks)
  const loaded = useSyncStore((state) => state.loaded)
  const jobs = useSyncStore((state) => state.jobs)
  const load = useSyncStore((state) => state.load)
  const deleteTask = useSyncStore((state) => state.deleteTask)
  const patchTask = useSyncStore((state) => state.patchTask)
  const runTask = useSyncStore((state) => state.runTask)
  const stopJob = useSyncStore((state) => state.stopJob)
  const rcloneRunning = useRcloneStore(
    (state) => state.status?.running ?? false
  )

  const [remotes, setRemotes] = useState<RemoteInfo[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SyncTask | null>(null)
  const [runConfirm, setRunConfirm] = useState<RunConfirm | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<SyncTask | null>(null)
  const [resyncConfirm, setResyncConfirm] = useState<SyncTask | null>(null)
  const [deleteName, setDeleteName] = useState("")

  useEffect(() => {
    void load()
    void call<{ remotes: RemoteInfo[] }>("/api/remotes")
      .then((data) => setRemotes(data.remotes))
      .catch(() => setRemotes([]))
    return subscribeSyncJobs()
  }, [load])

  const activeJobs = useMemo(
    () => jobs.filter((job) => !TERMINAL_JOB_STATUSES.has(job.status)),
    [jobs]
  )

  const requestRun = (task: SyncTask) => {
    if (task.destructive) {
      setRunConfirm({ task })
      return
    }
    void runTask(task.id).then(() =>
      toast.success(t("sync.runStarted", { name: task.name }))
    )
  }

  const confirmRun = async ({ task }: RunConfirm) => {
    setRunConfirm(null)
    const resync = bisyncNeedsResync(task)
    await runTask(task.id, { resync })
    toast.success(
      t(resync ? "sync.resyncStarted" : "sync.runStarted", { name: task.name })
    )
  }

  const requestResync = (task: SyncTask) => {
    if (task.last_result?.status !== "succeeded") {
      setResyncConfirm(task)
      return
    }
    void runTask(task.id, { resync: true })
  }

  const requestDelete = (task: SyncTask) => {
    setDeleteName("")
    setDeleteConfirm(task)
  }

  const stopTask = (task: SyncTask) => {
    const job = jobs.find(
      (item) =>
        item.edge_id === task.id && !TERMINAL_JOB_STATUSES.has(item.status)
    )
    if (job) {
      void stopJob(job.id)
    }
  }

  const confirmDelete = async () => {
    const task = deleteConfirm
    if (!task || deleteName.trim() !== task.name) {
      return
    }
    setDeleteConfirm(null)
    await deleteTask(task.id)
    toast.success(t("sync.deleteDone", { name: task.name }))
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 overflow-y-auto select-text">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-base font-semibold">
            {t("sync.title")}
          </h1>
          <p className="text-xs text-muted-foreground">{t("sync.subtitle")}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <PlusIcon />
          {t("sync.newTask")}
        </Button>
      </div>

      {!rcloneRunning ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {t("sync.rcloneOffline")}
        </p>
      ) : null}

      {activeJobs.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium text-muted-foreground">
            {t("sync.activeJobs")}
          </h2>
          {activeJobs.map((job) => (
            <ActiveJobRow
              key={job.id}
              job={job}
              onStop={() => void stopJob(job.id)}
            />
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-medium text-muted-foreground">
          {t("sync.taskList")}
        </h2>
        {!loaded ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {t("sync.loading")}
          </p>
        ) : tasks.length === 0 ? (
          <EmptyHint>{t("sync.empty")}</EmptyHint>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              jobs={jobs}
              onRun={() => requestRun(task)}
              onEdit={() => {
                setEditing(task)
                setDialogOpen(true)
              }}
              onDelete={() => requestDelete(task)}
              onToggleEnabled={(enabled) =>
                void patchTask(task.id, { enabled })
              }
              onResync={() => requestResync(task)}
              onStop={() => stopTask(task)}
            />
          ))
        )}
      </section>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        remotes={remotes}
      />

      <RunConfirmDialog
        confirm={runConfirm}
        onClose={() => setRunConfirm(null)}
        onConfirm={() => {
          if (runConfirm) {
            void confirmRun(runConfirm)
          }
        }}
      />

      <Dialog
        open={resyncConfirm !== null}
        onOpenChange={(open) => !open && setResyncConfirm(null)}
      >
        <DialogContent className="w-[min(92vw,28rem)] sm:max-w-none">
          <DialogHeader>
            <DialogTitle>{t("sync.resyncTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("sync.resyncWarning")}
          </p>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("common.cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                const task = resyncConfirm
                setResyncConfirm(null)
                if (task) {
                  void runTask(task.id, { resync: true })
                }
              }}
            >
              {t("sync.resyncAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent className="w-[min(92vw,28rem)] sm:max-w-none">
          <DialogHeader>
            <DialogTitle>{t("sync.deleteTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            <p className="leading-relaxed text-muted-foreground">
              {t("sync.deleteWarning", { name: deleteConfirm?.name ?? "" })}
            </p>
            <Input
              value={deleteName}
              placeholder={deleteConfirm?.name ?? ""}
              aria-label={t("sync.deleteTypeHint")}
              onChange={(event) => setDeleteName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("common.cancel")}
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleteName.trim() !== deleteConfirm?.name}
              onClick={() => void confirmDelete()}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TaskCard({
  task,
  jobs,
  onRun,
  onEdit,
  onDelete,
  onToggleEnabled,
  onResync,
  onStop,
}: {
  task: SyncTask
  jobs: JobSnapshot[]
  onRun: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleEnabled: (enabled: boolean) => void
  onResync: () => void
  onStop: () => void
}) {
  const { t } = useTranslation()
  const job = jobs.find(
    (item) =>
      item.edge_id === task.id && !TERMINAL_JOB_STATUSES.has(item.status)
  )
  const running = job !== undefined
  const lastResult = task.last_result

  return (
    <Card className="py-3">
      <CardContent className="flex flex-col gap-2 px-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{task.name}</span>
          <Badge variant="outline" className="font-normal">
            {operationLabel(task, t)}
          </Badge>
          {task.bw_limit ? (
            <Badge variant="secondary" className="font-normal">
              {t("sync.bwLimit")} {task.bw_limit}
            </Badge>
          ) : null}
          {task.max_transfer ? (
            <Badge variant="secondary" className="font-normal">
              {t("sync.maxTransfer")} {task.max_transfer}
            </Badge>
          ) : null}
          <span className="ms-auto flex items-center gap-3">
            <SwitchField
              label={t("sync.enabled")}
              checked={task.enabled}
              disabled={running}
              onCheckedChange={onToggleEnabled}
            />
          </span>
        </div>

        <div
          className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground"
          title={task.impact}
        >
          <span className="truncate font-mono text-xs">
            {task.source.kind === "remote"
              ? `${task.source.remote}:${task.source.path ?? ""}`
              : task.source.path}
          </span>
          <ArrowRightIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate font-mono text-xs">
            {task.target.kind === "remote"
              ? `${task.target.remote}:${task.target.path ?? ""}`
              : task.target.path}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ClockIcon className="size-3.5" aria-hidden />
            {scheduleLabel(task, t)}
          </span>
          <span>
            {t("sync.nextRun")}
            {formatTime(task.next_run)}
          </span>
          <span className="flex items-center gap-1">
            {t("sync.lastResult")}
            <StatusChip status={lastResult?.status ?? null} />
            {lastResult?.status === "failed" || lastResult?.error ? (
              <span className="max-w-56 truncate" title={lastResult.error}>
                {lastResult.error}
              </span>
            ) : null}
          </span>
        </div>

        {running && job ? <JobProgress job={job} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs" disabled={running || !task.enabled} onClick={onRun}>
            <PlayIcon />
            {t("sync.runNow")}
          </Button>
          {running ? (
            <Button size="xs" variant="outline" onClick={onStop}>
              <SquareIcon />
              {t("sync.stop")}
            </Button>
          ) : null}
          {task.operation === "bisync" && !running ? (
            <Button size="xs" variant="outline" onClick={onResync}>
              <RefreshCcwIcon />
              {t("sync.resyncAction")}
            </Button>
          ) : null}
          <span className="ms-auto flex items-center gap-1">
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={t("common.edit")}
              title={t("common.edit")}
              onClick={onEdit}
            >
              <PencilIcon />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={t("common.delete")}
              title={t("common.delete")}
              onClick={onDelete}
            >
              <TrashIcon />
            </Button>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

/** 运行确认：展示源、目标和影响，满足危险操作的确认要求。 */
function RunConfirmDialog({
  confirm,
  onClose,
  onConfirm,
}: {
  confirm: RunConfirm | null
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const task = confirm?.task
  const resync = task ? bisyncNeedsResync(task) : false
  const impactKey =
    task?.operation === "bisync"
      ? "sync.impactBisync"
      : task?.operation === "move"
        ? "sync.impactMove"
        : "sync.impactSync"
  return (
    <Dialog open={confirm !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(92vw,30rem)] sm:max-w-none">
        <DialogHeader>
          <DialogTitle>
            {resync ? t("sync.resyncTitle") : t("sync.runConfirmTitle")}
          </DialogTitle>
        </DialogHeader>
        {task ? (
          <div className="flex flex-col gap-3 text-sm">
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 rounded-lg bg-muted px-3 py-2">
              <dt className="text-xs text-muted-foreground">
                {t("sync.source")}
              </dt>
              <dd className="truncate font-mono text-xs">
                {task.source.kind === "remote"
                  ? `${task.source.remote}:${task.source.path ?? ""}`
                  : task.source.path}
              </dd>
              <dt className="text-xs text-muted-foreground">
                {t("sync.target")}
              </dt>
              <dd className="truncate font-mono text-xs">
                {task.target.kind === "remote"
                  ? `${task.target.remote}:${task.target.path ?? ""}`
                  : task.target.path}
              </dd>
            </dl>
            <p className="leading-relaxed">{t(impactKey)}</p>
            {task.operation === "bisync" ? (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                {resync ? t("sync.resyncWarning") : t("sync.bisyncWarning")}
              </p>
            ) : null}
            {task.operation === "sync" ? (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                {t("sync.opSyncHint")}
              </p>
            ) : null}
            {task.operation === "move" ? (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                {t("sync.opMoveHint")}
              </p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm}>
            {resync ? t("sync.resyncAction") : t("sync.runNow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 任务快照端点的可读显示，与后端 Locator.Display() 一致。 */
function locatorLabel(locator: JobLocator): string {
  if (locator.kind === "remote") {
    return `${locator.fs.replace(/:$/, "")}:${locator.remote}`
  }
  return locator.remote ? `${locator.fs}/${locator.remote}` : locator.fs
}

function ActiveJobRow({
  job,
  onStop,
}: {
  job: JobSnapshot
  onStop: () => void
}) {
  const { t } = useTranslation()
  return (
    <Card className="py-2">
      <CardContent className="flex items-center gap-3 px-3">
        <GaugeIcon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="truncate font-medium">
              {job.operation} · {locatorLabel(job.source)}
              <ArrowRightIcon className="mx-1 inline size-3" aria-hidden />
              {locatorLabel(job.target)}
            </span>
            <StatusChip status={job.status} />
            <span className="shrink-0 text-muted-foreground">
              {formatBytes(job.progress.bytes)} · {job.progress.transfers}{" "}
              {t("sync.transfersCount")} · {formatBytes(job.progress.speed)}/s
            </span>
          </div>
          <JobProgressBar percentage={job.progress.percentage} />
        </div>
        <Button size="xs" variant="outline" onClick={onStop}>
          <SquareIcon />
          {t("sync.stop")}
        </Button>
      </CardContent>
    </Card>
  )
}

function JobProgress({ job }: { job: JobSnapshot }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <StatusChip status={job.status} />
        <span>
          {formatBytes(job.progress.bytes)} · {job.progress.transfers}{" "}
          {t("sync.transfersCount")} · {formatBytes(job.progress.speed)}/s
        </span>
        {job.progress.errors > 0 ? (
          <span className="text-destructive">
            {t("sync.errorCount", { count: job.progress.errors })}
          </span>
        ) : null}
      </div>
      <JobProgressBar percentage={job.progress.percentage} />
    </div>
  )
}

function JobProgressBar({ percentage }: { percentage: number }) {
  const value = Math.min(100, Math.max(0, percentage))
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}
