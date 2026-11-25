import type { ReactNode } from "react"

import { cn } from "cn"

/**
 * 统一页头：标题 + 一句话描述 + 右侧操作区。
 * 所有路由页面共用，保证排版一致。
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="font-heading text-lg leading-tight font-semibold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

/**
 * 标准滚动页容器：限宽居中、自带滚动与留白。
 * 全高布局（设置、API 演示）不使用它，各自管理滚动。
 */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6",
        className
      )}
    >
      {children}
    </div>
  )
}
