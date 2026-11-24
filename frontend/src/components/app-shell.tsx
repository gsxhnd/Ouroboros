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
 * 应用外壳：顶部承载全局状态与控制，左侧侧边栏承载功能导航。
 * 画布移除后不再有浮层页面：侧边栏直接切换主区域视图，Dialog 只保留在
 * 表单（新建任务 / 新建 remote）和危险操作确认里。
 */
type View = "tasks" | "files" | "storages" | "overview" | "settings" | "api"

export function AppShell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const status = useRcloneStore((state) => state.status)
  const busy = useRcloneStore((state) => state.busy)
  const start = useRcloneStore((state) => state.start)
  const stop = useRcloneStore((state) => state.stop)

  const [view, setView] = useState<View>("tasks")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(sidebarStorageKey) === "collapsed"
  )

  /** 侧边栏的「任务」即主视图。 */
  const showTasks = () => setView("tasks")

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
            onOpenOverview={() => setView("overview")}
            onOpenFiles={() => setView("files")}
            onOpenStorages={() => setView("storages")}
            onOpenSettings={() => setView("settings")}
            onOpenApi={() => setView("api")}
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
              active={view === "tasks"}
              collapsed={sidebarCollapsed}
              onClick={showTasks}
            />
            <SidebarItem
              icon={<FolderOpenIcon />}
              label={t("nav.files")}
              active={view === "files"}
              collapsed={sidebarCollapsed}
              onClick={() => setView("files")}
            />
            <SidebarItem
              icon={<HardDriveIcon />}
              label={t("nav.storages")}
              active={view === "storages"}
              collapsed={sidebarCollapsed}
              onClick={() => setView("storages")}
            />
            <SidebarItem
              icon={<GaugeIcon />}
              label={t("nav.overview")}
              active={view === "overview"}
              collapsed={sidebarCollapsed}
              onClick={() => setView("overview")}
            />
            <SidebarItem
              icon={<SettingsIcon />}
              label={t("nav.settings")}
              active={view === "settings"}
              collapsed={sidebarCollapsed}
              onClick={() => setView("settings")}
            />
            <SidebarItem
              icon={<TerminalSquareIcon />}
              label={t("nav.api")}
              active={view === "api"}
              collapsed={sidebarCollapsed}
              onClick={() => setView("api")}
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

        <main className="flex min-h-0 flex-1 flex-col bg-muted/40 p-3 select-text">
          {view === "tasks" && children}
          {view === "files" && (
            <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 overflow-y-auto">
              <FilesPage />
            </div>
          )}
          {view === "storages" && <StoragesPage />}
          {view === "overview" && (
            <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 overflow-y-auto">
              <OverviewPage />
            </div>
          )}
          {view === "settings" && <SettingsPage />}
          {view === "api" && <ApiPlayground />}
        </main>
      </div>
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
