import { useEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  FolderOpenIcon,
  FolderSyncIcon,
  GaugeIcon,
  HardDriveIcon,
  Loader2Icon,
  MoonIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlayIcon,
  RefreshCcwIcon,
  SettingsIcon,
  SquareIcon,
  SunIcon,
  TerminalSquareIcon,
} from "lucide-react"

import { ApiPlayground } from "@/components/api-playground"
import { CommandPalette } from "@/components/command-palette"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTheme } from "@/components/theme-provider"
import { changeLanguage, type Locale } from "@/i18n"
import { isDesktop, isMacDesktop } from "@/lib/platform"
import { FilesPage } from "@/pages/files"
import { OverviewPage } from "@/pages/overview"
import { SettingsPage } from "@/pages/settings"
import { StoragesPage } from "@/pages/storages"
import { startRcloneStatusPolling, useRcloneStore } from "@/stores/rclone-store"
import type { RcloneStatus } from "@/lib/types"
import { cn } from "cn"

/**
 * 顶栏高度按平台区分：macOS 隐藏了标题栏，红绿灯与顶栏共用一行，需要更高；
 * Windows / Linux 使用系统原生的桌面 header 高度，保持与常见应用一致。
 */
const headerHeight = isMacDesktop ? "h-12" : isDesktop ? "h-10" : "h-14 md:h-12"

/**
 * 侧边栏折叠状态的 localStorage 键，与 ourboros.lang 等应用级键共用前缀。
 */
const sidebarStorageKey = "ourboros.sidebar"

/**
 * 应用外壳：顶部承载全局状态与控制，左侧侧边栏承载功能导航；
 * 同步任务页是唯一的主视图，概览、文件、存储、设置和接口演示以浮层形式打开，不切换页面。
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const status = useRcloneStore((state) => state.status)
  const busy = useRcloneStore((state) => state.busy)
  const start = useRcloneStore((state) => state.start)
  const stop = useRcloneStore((state) => state.stop)

  const [overviewOpen, setOverviewOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [apiOpen, setApiOpen] = useState(false)
  const [filesOpen, setFilesOpen] = useState(false)
  const [storagesOpen, setStoragesOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(sidebarStorageKey) === "collapsed"
  )

  /** 侧边栏的「任务」即主视图：点击时收起全部浮层。 */
  const closeOverlays = () => {
    setOverviewOpen(false)
    setSettingsOpen(false)
    setApiOpen(false)
    setFilesOpen(false)
    setStoragesOpen(false)
  }

  const toggleSidebar = () =>
    setSidebarCollapsed((current) => {
      const next = !current
      localStorage.setItem(sidebarStorageKey, next ? "collapsed" : "expanded")
      return next
    })

  useEffect(() => startRcloneStatusPolling(), [])

  const running = status?.running ?? false
  const offline = status === null
  const nextLocale: Locale = i18n.language.startsWith("zh") ? "en" : "zh"

  return (
    <div className="flex h-svh flex-col bg-background text-foreground select-none">
      <header
        className={cn(
          "flex shrink-0 items-center justify-between gap-3 border-b bg-background px-3 [--wails-draggable:drag]",
          headerHeight,
          isMacDesktop && "pl-[84px]"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <span
            className="grid size-5 shrink-0 place-items-center rounded bg-primary text-[9px] font-semibold text-primary-foreground"
            aria-hidden
          >
            O
          </span>
          <span className="font-heading text-xs font-semibold tracking-tight">
            Ourboros
          </span>
          <div className="hidden min-w-0 shrink-0 overflow-hidden sm:block">
            <RcloneStatusPill
              offline={offline}
              running={running}
              status={status}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 [--wails-draggable:no-drag]">
          <CommandPalette
            isDark={theme === "dark"}
            isRunning={running}
            isMac={isMacDesktop}
            onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
            onToggleLanguage={() => changeLanguage(nextLocale)}
            onToggleRclone={() => void (running ? stop() : start())}
            onOpenOverview={() => setOverviewOpen(true)}
            onOpenFiles={() => setFilesOpen(true)}
            onOpenStorages={() => setStoragesOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenApi={() => setApiOpen(true)}
          />

          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          {!offline ? (
            <Button
              variant="outline"
              size="xs"
              disabled={busy}
              onClick={() => void (running ? stop() : start())}
              aria-label={
                running ? t("shell.stopRclone") : t("shell.startRclone")
              }
            >
              {busy ? (
                <Loader2Icon className="animate-spin" />
              ) : running ? (
                <SquareIcon />
              ) : (
                <PlayIcon />
              )}
              {running ? t("common.stop") : t("common.start")}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="xs"
              onClick={() => void useRcloneStore.getState().refresh()}
            >
              <RefreshCcwIcon />
              {t("shell.retry")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6 rounded-full text-[10px] font-semibold"
            aria-label={t("shell.switchLanguage")}
            onClick={() => changeLanguage(nextLocale)}
          >
            {nextLocale === "zh" ? "中" : "EN"}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6 [&>svg]:size-3.5"
            aria-label={
              theme === "dark" ? t("shell.toLight") : t("shell.toDark")
            }
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "flex shrink-0 flex-col border-e bg-background transition-[width] [--wails-draggable:no-drag]",
            sidebarCollapsed ? "w-11" : "w-44"
          )}
        >
          <nav
            aria-label={t("nav.mainNav")}
            className="flex min-h-0 flex-1 flex-col gap-1 p-1.5"
          >
            <SidebarItem
              icon={<FolderSyncIcon />}
              label={t("nav.tasks")}
              active
              collapsed={sidebarCollapsed}
              onClick={closeOverlays}
            />
            <SidebarItem
              icon={<FolderOpenIcon />}
              label={t("nav.files")}
              collapsed={sidebarCollapsed}
              onClick={() => setFilesOpen(true)}
            />
            <SidebarItem
              icon={<HardDriveIcon />}
              label={t("nav.storages")}
              collapsed={sidebarCollapsed}
              onClick={() => setStoragesOpen(true)}
            />
            <SidebarItem
              icon={<GaugeIcon />}
              label={t("nav.overview")}
              collapsed={sidebarCollapsed}
              onClick={() => setOverviewOpen(true)}
            />
            <SidebarItem
              icon={<SettingsIcon />}
              label={t("nav.settings")}
              collapsed={sidebarCollapsed}
              onClick={() => setSettingsOpen(true)}
            />
            <SidebarItem
              icon={<TerminalSquareIcon />}
              label={t("nav.api")}
              collapsed={sidebarCollapsed}
              onClick={() => setApiOpen(true)}
            />
          </nav>
          <div
            className={cn(
              "flex p-1.5",
              sidebarCollapsed ? "justify-center" : "justify-end"
            )}
          >
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={
                sidebarCollapsed
                  ? t("shell.expandSidebar")
                  : t("shell.collapseSidebar")
              }
              title={
                sidebarCollapsed
                  ? t("shell.expandSidebar")
                  : t("shell.collapseSidebar")
              }
              onClick={toggleSidebar}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpenIcon />
              ) : (
                <PanelLeftCloseIcon />
              )}
            </Button>
          </div>
        </aside>

        <main className="flex min-h-0 flex-1 flex-col bg-muted/40 p-3">
          {children}
        </main>
      </div>

      <Dialog open={overviewOpen} onOpenChange={setOverviewOpen}>
        <DialogContent className="flex h-[min(86vh,44rem)] w-[min(94vw,44rem)] max-w-none flex-col gap-0 p-0 sm:max-w-none">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>{t("nav.overview")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 select-text">
            <div className="flex flex-col gap-3">
              <OverviewPage />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={storagesOpen} onOpenChange={setStoragesOpen}>
        <DialogContent className="flex h-[min(86vh,54rem)] w-[min(94vw,64rem)] max-w-none flex-col gap-0 p-0 sm:max-w-none">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>{t("nav.storages")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 select-text">
            <StoragesPage />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={filesOpen} onOpenChange={setFilesOpen}>
        <DialogContent className="flex h-[min(86vh,54rem)] w-[min(94vw,72rem)] max-w-none flex-col gap-0 p-0 sm:max-w-none">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>{t("nav.files")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 select-text">
            <FilesPage />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="flex h-[min(86vh,54rem)] w-[min(94vw,64rem)] max-w-none flex-col gap-0 p-0 sm:max-w-none">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>{t("nav.settings")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 select-text">
            <SettingsPage />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={apiOpen} onOpenChange={setApiOpen}>
        <DialogContent className="flex h-[min(85vh,52rem)] w-[min(94vw,80rem)] max-w-none flex-col gap-0 p-0 sm:max-w-none">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>{t("nav.api")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden select-text [&>div]:h-full">
            <ApiPlayground />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 侧边栏导航项：折叠时只显示图标，靠 title 提示名称。 */
function SidebarItem({
  icon,
  label,
  collapsed,
  active,
  onClick,
}: {
  icon: ReactNode
  label: string
  collapsed: boolean
  active?: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      className={cn(
        "w-full text-muted-foreground hover:text-foreground",
        collapsed ? "justify-center px-0" : "justify-start gap-2"
      )}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      onClick={onClick}
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </Button>
  )
}

function RcloneStatusPill({
  offline,
  running,
  status,
}: {
  offline: boolean
  running: boolean
  status: RcloneStatus | null
}) {
  const { t } = useTranslation()
  const label = offline
    ? t("shell.offline")
    : running
      ? status?.mode === "attached"
        ? t("shell.connected")
        : t("shell.running")
      : t("shell.stopped")
  const dotClass = offline
    ? "bg-destructive"
    : running
      ? "animate-pulse bg-emerald-500"
      : "bg-amber-500"

  return (
    <div
      className="flex min-w-0 items-center gap-2"
      role="status"
      aria-live="polite"
    >
      <span
        className={cn("size-2 shrink-0 rounded-full", dotClass)}
        aria-hidden
      />
      <Badge variant="outline" className="font-normal">
        {label}
      </Badge>
    </div>
  )
}
