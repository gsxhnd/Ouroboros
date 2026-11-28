import { useTranslation } from "react-i18next"
import { ChevronDownIcon } from "lucide-react"

import { StatusChip } from "@/components/common/status-chip"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  locatorLabel,
  operationLabel,
  triggerLabel,
} from "@/features/sync/labels"
import type { SyncRun } from "@/lib/types"
import { formatBytes, formatTime, runDuration } from "@/lib/format"
import { cn } from "cn"

/** 单条执行记录的展开详情：错误、统计与端点。 */
function RunDetail({ run }: { run: SyncRun }) {
  const { t } = useTranslation()
  const stats = run.stats
  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 text-xs">
      {run.error ? (
        <p
          className="rounded-md bg-destructive/10 px-3 py-2 font-mono whitespace-pre-wrap text-destructive"
          data-testid="run-error"
        >
          {run.error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
        <span>
          {t("sync.transferred")}
          {formatBytes(stats?.bytes ?? null)}
        </span>
        <span>
          {stats?.transfers ?? 0} {t("sync.transfersCount")}
        </span>
        <span>
          {t("sync.checks")}
          {stats?.checks ?? 0}
        </span>
        <span className={cn((stats?.errors ?? 0) > 0 && "text-destructive")}>
          {t("sync.errorCount", { count: stats?.errors ?? 0 })}
        </span>
        <span>
          {t("sync.speed")}
          {stats ? `${formatBytes(stats.speed)}/s` : "—"}
        </span>
        <span>
          {t("sync.duration")}
          {runDuration(run.started_at, run.finished_at)}
        </span>
      </div>
      <p className="flex min-w-0 flex-wrap items-center gap-1 text-muted-foreground">
        <span className="min-w-0 truncate font-mono">
          {locatorLabel(run.source)}
        </span>
        →
        <span className="min-w-0 truncate font-mono">
          {locatorLabel(run.target)}
        </span>
      </p>
      <p className="truncate font-mono text-muted-foreground/70">
        {t("sync.runId")}
        {run.id}
      </p>
    </div>
  )
}

/** 一条执行记录：状态、触发来源、开始时间、耗时与传输量，点击展开详情。 */
export function RunRow({
  run,
  expanded,
  onToggle,
}: {
  run: SyncRun
  expanded: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  return (
    <Card className="py-0">
      <CardContent className="px-0">
        <button
          type="button"
          className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-start transition-colors hover:bg-muted/50"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <StatusChip status={run.status} />
          <Badge variant="outline" className="font-normal">
            {triggerLabel(run.trigger, t)}
          </Badge>
          <Badge variant="secondary" className="font-normal">
            {operationLabel(run, t)}
          </Badge>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {formatTime(run.started_at)}
          </span>
          <span className="text-xs text-muted-foreground">
            {runDuration(run.started_at, run.finished_at)}
          </span>
          {run.stats ? (
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              {formatBytes(run.stats.bytes)}
            </span>
          ) : null}
          {run.error ? (
            <span
              className="max-w-48 truncate text-xs text-destructive"
              title={run.error}
            >
              {run.error}
            </span>
          ) : null}
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
            aria-hidden
          />
        </button>
        {expanded ? <RunDetail run={run} /> : null}
      </CardContent>
    </Card>
  )
}
