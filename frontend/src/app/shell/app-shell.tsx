import { useEffect, useState } from "react"
import { Outlet } from "react-router"
import type { Layout } from "react-resizable-panels"

import { AppHeader } from "@/app/shell/app-header"
import { Sidebar } from "@/app/shell/sidebar"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { startRcloneStatusPolling } from "@/stores/rclone-store"

/**
 * 应用外壳布局：侧边栏贯穿窗口全高，展开时可拖宽（ui/resizable，布局
 * 持久化到 localStorage），也可折叠成图标轨；右侧列 = 顶栏 + 路由主区。
 * Dialog 只保留在表单（新建任务 / 新建 remote）和危险操作确认里。
 */
const SIDEBAR_STORAGE_KEY = "ourboros.sidebar"
const SIDEBAR_LAYOUT_KEY = "ourboros.sidebar-layout"

function readSidebarLayout(): Layout | undefined {
  try {
    const raw = localStorage.getItem(SIDEBAR_LAYOUT_KEY)
    return raw ? (JSON.parse(raw) as Layout) : undefined
  } catch {
    return undefined
  }
}

export function AppShell() {
  useEffect(() => startRcloneStatusPolling(), [])

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed"
  )

  const toggleCollapsed = () =>
    setCollapsed((current) => {
      localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        current ? "expanded" : "collapsed"
      )
      return !current
    })

  const mainColumn = (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <AppHeader
        sidebarCollapsed={collapsed}
        onToggleSidebar={toggleCollapsed}
      />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/40 select-text">
        <Outlet />
      </main>
    </div>
  )

  return (
    <div className="flex h-svh bg-background text-foreground select-none">
      {collapsed ? (
        <>
          <Sidebar collapsed />
          {mainColumn}
        </>
      ) : (
        <ResizablePanelGroup
          orientation="horizontal"
          defaultLayout={readSidebarLayout()}
          onLayoutChanged={(layout) => {
            try {
              localStorage.setItem(SIDEBAR_LAYOUT_KEY, JSON.stringify(layout))
            } catch {
              // 忽略存储失败；本次会话内布局仍然生效。
            }
          }}
        >
          <ResizablePanel
            id="sidebar"
            defaultSize={216}
            minSize={160}
            maxSize={420}
          >
            <Sidebar collapsed={false} />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel id="main">{mainColumn}</ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  )
}
