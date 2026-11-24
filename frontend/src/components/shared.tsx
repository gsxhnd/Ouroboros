import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "cn"

/**
 * 表单里的下拉选择，内部是 shadcn ui/select（Base UI 弹层）。
 * 保留旧的原生 select 契约：value 为 "" 表示未选，placeholder 是一个
 * 可选项；映射为 Base UI 的 null 中性值以获得占位符样式。
 */
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
      <Select
        items={options}
        value={value === "" ? null : value}
        onValueChange={(next) => onChange((next ?? "") as T)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder ?? ""} />
        </SelectTrigger>
        <SelectContent>
          {placeholder ? <SelectItem value="">{placeholder}</SelectItem> : null}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * 带文字标签的开关，内部是 shadcn ui/switch。
 * Base UI 把 switch 渲染成按钮，label 元素的原生联动不可依赖：点在
 * 文本 / 空白处手动切换；点在开关本体上交给 Switch 自己处理（冒泡上来
 * 时 target 在开关内，直接跳过，避免双切）。
 */
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
    <div
      className={cn(
        "flex items-center gap-2 text-sm select-none",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      )}
      onClick={(event) => {
        if (disabled) {
          return
        }
        if (
          event.target instanceof Element &&
          event.target.closest("[data-slot=switch]")
        ) {
          return
        }
        onCheckedChange(!checked)
      }}
    >
      <Switch
        aria-label={label}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
      <span>{label}</span>
    </div>
  )
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

/** 琥珀色警告条：rclone 未运行、双向同步影响等风险提示统一用它。 */
export function WarningNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
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
