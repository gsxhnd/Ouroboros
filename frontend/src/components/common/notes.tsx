import type { ReactNode } from "react"

import { Spinner } from "@/components/ui/spinner"

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center rounded-xl bg-card px-6 py-12 text-center ring-1 ring-foreground/10">
      <p className="max-w-md text-sm text-pretty text-muted-foreground">
        {children}
      </p>
    </div>
  )
}

/** 列表还在拉取时的占位，和空状态共用同一块卡片表面。 */
export function LoadingBlock({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl bg-card px-6 py-12 text-sm text-muted-foreground ring-1 ring-foreground/10">
      <Spinner />
      {children}
    </div>
  )
}

/** 风险提示：rclone 未运行、双向同步影响等，跟成功/进行中状态共用警告色。 */
export function WarningNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm leading-relaxed text-pretty text-warning-foreground ring-1 ring-warning/30">
      {children}
    </p>
  )
}
