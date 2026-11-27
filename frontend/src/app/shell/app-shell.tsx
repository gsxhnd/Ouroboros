import { useEffect, useState } from "react"
import { Outlet } from "react-router"
import type { Layout } from "react-resizable-panels"

import { AppHeader } from "@/app/shell/app-header"
import { MobileSidebar } from "@/app/shell/mobile-sidebar"
import { Sidebar } from "@/app/shell/sidebar"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { startRcloneStatusPolling } from "@/stores/rclone-store"
import { useMediaQuery } from "@/lib/use-media-query"

/**
 * 应用外壳布局：桌面（md 及以上）侧边栏贯穿窗口全高，展开时可拖宽
 * （ui/resizable，布局持久化到 localStorage），也可折叠成图标轨；
 * 右侧列 = 顶栏 + 路由主区。移动端不渲染常驻侧栏，由顶栏开关唤出
 * 抽屉式侧栏（MobileSidebar）。Dialog 只保留在表单（新建任务 / 新建
 * remote）和危险操作确认里。
 */
const SIDEBAR_STORAGE_KEY = "ourboros.sidebar"
const SIDEBAR_LAYOUT_KEY = "ourboros.sidebar-layout"

/** 与 Tailwind 的 md 断点一致：767px 及以下按移动端处理。 */
const MOBILE_QUERY = "(max-width: 767px)"

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

  const isMobile = useMediaQuery(MOBILE_QUERY)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed"
  )
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 断点切回桌面时收起抽屉，避免旋转屏幕后抽屉保持打开。
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY)
    const onChange = () => {
      if (!query.matches) {
        setDrawerOpen(false)
      }
    }
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

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
        onToggleSidebar={() =>
          isMobile ? setDrawerOpen(true) : toggleCollapsed()
        }
        mobile={isMobile}
      />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/40 select-text">
        <Outlet />
      </main>
    </div>
  )

  if (isMobile) {
    return (
      <div className="flex h-svh bg-background text-foreground select-none">
        {mainColumn}
        <MobileSidebar open={drawerOpen} onOpenChange={setDrawerOpen}>
          <Sidebar collapsed={false} />
        </MobileSidebar>
      </div>
    )
  }

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
