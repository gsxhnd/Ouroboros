import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Label } from "@/components/ui/label"
import { cn } from "cn"

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 disabled:cursor-not-allowed disabled:opacity-50"

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
  placeholder,
}: {
  label?: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? <Label>{label}</Label> : null}
      <select
        className={SELECT_CLASS}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function SwitchField({
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
      <input
        type="checkbox"
        className="size-4 accent-[var(--primary)]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      {label}
    </label>
  )
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

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
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  busy: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  bad: "bg-destructive/10 text-destructive",
  idle: "bg-muted text-muted-foreground",
}

const DOT_CLASS: Record<Tone, string> = {
  ok: "bg-emerald-500",
  busy: "animate-pulse bg-amber-500",
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
