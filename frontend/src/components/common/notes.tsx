import type { ReactNode } from "react"

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
