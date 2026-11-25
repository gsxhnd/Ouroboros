import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
          <SelectGroup>
            {placeholder ? (
              <SelectItem value="">{placeholder}</SelectItem>
            ) : null}
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
