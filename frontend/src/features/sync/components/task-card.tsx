import { useTranslation } from "react-i18next"
import {
  ArrowRightIcon,
  ClockIcon,
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
import type { JobSnapshot, SyncTask } from "@/lib/types"
import { formatTime } from "@/lib/format"
import { TERMINAL_JOB_STATUSES } from "@/features/sync/sync-store"

/** 单个同步任务卡片：徽标、端点、计划、最近结果与操作。 */
export function TaskCard({
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
    <Card className="py-0">
      <CardContent className="flex flex-col px-0">
        <div className="flex flex-col gap-3 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
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
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
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
