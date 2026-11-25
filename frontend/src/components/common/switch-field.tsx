import { Switch } from "@/components/ui/switch"
import { cn } from "cn"

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
