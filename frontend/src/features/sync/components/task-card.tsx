import { useTranslation } from "react-i18next"
import {
  ArrowRightIcon,
  ClockIcon,
  HistoryIcon,
  PencilIcon,
  PlayIcon,
  RefreshCcwIcon,
  SquareIcon,
  TrashIcon,
} from "lucide-react"

import { StatusChip } from "@/components/common/status-chip"
import { SwitchField } from "@/components/common/switch-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { JobProgress } from "@/features/sync/components/job-rows"
import {
  endpointLabel,
  operationLabel,
  scheduleLabel,
} from "@/features/sync/labels"
import type { JobSnapshot, SyncRun, SyncTask } from "@/lib/types"
import { formatBytes, formatTime, runDuration } from "@/lib/format"
import { TERMINAL_JOB_STATUSES } from "@/features/sync/sync-store"

/**
 * 单个同步任务卡片（任务页概览）：徽标、端点、计划、最近一次执行与操作。
 * 点击卡片进入该任务的执行记录页；开关与按钮区阻断冒泡保持原交互。
 */
export function TaskCard({
  task,
  jobs,
  latest,
  onOpen,
  onRun,
  onEdit,
  onDelete,
  onToggleEnabled,
  onResync,
  onStop,
}: {
  task: SyncTask
  jobs: JobSnapshot[]
  latest?: SyncRun | null
  onOpen: () => void
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
    <Card
      className="cursor-pointer py-0 transition-colors hover:border-foreground/20"
      onClick={onOpen}
      title={t("sync.viewRuns")}
    >
      <CardContent className="flex flex-col px-0">
        <div className="flex flex-col gap-3 px-4 py-4">
          <div
            className="flex items-start justify-between gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium">{task.name}</span>
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
            </div>
            <SwitchField
              label={t("sync.enabled")}
              checked={task.enabled}
              disabled={running}
              onCheckedChange={onToggleEnabled}
            />
          </div>

          <div
            className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/60 px-3 py-2"
            title={task.impact}
          >
            <span className="min-w-0 flex-1 truncate font-mono text-xs">
              {endpointLabel(task.source)}
            </span>
            <ArrowRightIcon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate font-mono text-xs">
              {endpointLabel(task.target)}
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
            <span className="flex min-w-0 items-center gap-1">
              {t("sync.lastResult")}
              <StatusChip status={lastResult?.status ?? null} />
              {latest ? (
                <span className="whitespace-nowrap">
                  · {runDuration(latest.started_at, latest.finished_at)}
                  {latest.stats ? ` · ${formatBytes(latest.stats.bytes)}` : ""}
                </span>
              ) : null}
              {lastResult?.status === "failed" || lastResult?.error ? (
                <span className="max-w-56 truncate" title={lastResult.error}>
                  {lastResult.error}
                </span>
              ) : null}
            </span>
          </div>

          {running && job ? <JobProgress job={job} /> : null}
        </div>

        <Separator />
        <div
          className="flex flex-wrap items-center gap-2 px-4 py-3"
          onClick={(event) => event.stopPropagation()}
        >
          <Button size="xs" disabled={running || !task.enabled} onClick={onRun}>
            <PlayIcon data-icon="inline-start" />
            {t("sync.runNow")}
          </Button>
          {running ? (
            <Button size="xs" variant="outline" onClick={onStop}>
              <SquareIcon data-icon="inline-start" />
              {t("sync.stop")}
            </Button>
          ) : null}
          {task.operation === "bisync" && !running ? (
            <Button size="xs" variant="outline" onClick={onResync}>
              <RefreshCcwIcon data-icon="inline-start" />
              {t("sync.resyncAction")}
            </Button>
          ) : null}
          <span className="ms-auto flex items-center gap-1">
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={t("sync.viewRuns")}
              title={t("sync.viewRuns")}
              onClick={onOpen}
            >
              <HistoryIcon />
            </Button>
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
