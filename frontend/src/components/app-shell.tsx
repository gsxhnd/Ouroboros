import { useEffect } from "react"
import { Outlet } from "react-router"

import { AppHeader } from "@/components/shell/app-header"
import { Sidebar } from "@/components/shell/sidebar"
import { startRcloneStatusPolling } from "@/stores/rclone-store"

/**
 * 应用外壳布局：顶部承载全局状态与控制，左侧侧边栏承载分组导航，
 * 主区域由路由渲染（<Outlet />）。Dialog 只保留在表单
 * （新建任务 / 新建 remote）和危险操作确认里。
 */
export function AppShell() {
  useEffect(() => startRcloneStatusPolling(), [])

  return (
    <div className="flex h-svh flex-col bg-background text-foreground select-none">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/40 select-text">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
