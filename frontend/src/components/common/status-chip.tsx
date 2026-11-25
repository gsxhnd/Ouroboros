import { useTranslation } from "react-i18next"

import { cn } from "cn"

type Tone = "ok" | "busy" | "bad" | "idle"

/** 已知状态的色调；文案统一走 status.* 语言包，未知状态原样显示。 */
const STATUS_TONES: Record<string, Tone> = {
  running: "ok",
  mounted: "ok",
  succeeded: "ok",
  completed: "ok",
  starting: "busy",
  stopping: "busy",
  queued: "busy",
  cancelling: "busy",
  downloading: "busy",
  verifying: "busy",
  extracting: "busy",
  failed: "bad",
  partial_failed: "bad",
  stopped: "idle",
  cancelled: "idle",
  expired: "idle",
}

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-success/12 text-success-foreground",
  busy: "bg-warning/15 text-warning-foreground",
  bad: "bg-destructive/10 text-destructive",
  idle: "bg-muted text-muted-foreground",
}

const DOT_CLASS: Record<Tone, string> = {
  ok: "bg-success",
  busy: "animate-pulse bg-warning",
  bad: "bg-destructive",
  idle: "bg-muted-foreground/50",
}

/** 任务、挂载、rclone 等状态的统一标签，颜色表达成功 / 进行中 / 失败 / 空闲。 */
export function StatusChip({ status }: { status: string | null }) {
  const { t } = useTranslation()
  if (!status) {
    return <span className="text-muted-foreground">—</span>
  }
  const tone = STATUS_TONES[status] ?? ("idle" as Tone)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
        TONE_CLASS[tone]
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", DOT_CLASS[tone])}
        aria-hidden
      />
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  )
}
