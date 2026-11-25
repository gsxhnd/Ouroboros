import { useTranslation } from "react-i18next"
import { ArrowRightIcon, GaugeIcon, SquareIcon } from "lucide-react"

import { StatusChip } from "@/components/common/status-chip"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { locatorLabel, operationLabel } from "@/features/sync/labels"
import { Progress } from "@/components/ui/progress"
import type { JobSnapshot } from "@/lib/types"
import { formatBytes } from "@/lib/format"

/** 顶部「运行中任务」一行的紧凑展示。 */
export function ActiveJobRow({
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
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {operationLabel(job, t)}
            </span>
            <StatusChip status={job.status} />
          </div>
          <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <span className="min-w-0 truncate">{locatorLabel(job.source)}</span>
            <ArrowRightIcon className="size-3 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{locatorLabel(job.target)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(job.progress.bytes)} · {job.progress.transfers}{" "}
            {t("sync.transfersCount")} · {formatBytes(job.progress.speed)}/s
          </p>
          <JobProgressBar percentage={job.progress.percentage} />
        </div>
        <Button size="xs" variant="outline" onClick={onStop}>
          <SquareIcon data-icon="inline-start" />
          {t("sync.stop")}
        </Button>
      </CardContent>
    </Card>
  )
}

/** 任务卡片内嵌的实时进度块。 */
export function JobProgress({ job }: { job: JobSnapshot }) {
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

/** 任务进度的统一进度条，内部是 shadcn ui/progress（自带 progressbar 语义）。 */
function JobProgressBar({ percentage }: { percentage: number }) {
  const value = Math.min(100, Math.max(0, percentage))
  return <Progress value={value} />
}
