import { useEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  CableIcon,
  FolderTreeIcon,
  HardDriveIcon,
  KeyRoundIcon,
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

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTheme } from "@/components/theme-provider"
import { changeLanguage, type Locale } from "@/i18n"
import { isDesktop, isMacDesktop } from "@/lib/platform"
import { startRcloneStatusPolling, useRcloneStore } from "@/stores/rclone-store"
import type { RcloneStatus } from "@/lib/types"
import { cn } from "cn"

export type PageId =
  "overview" | "files" | "remotes" | "transfers" | "mounts" | "settings" | "api"

type NavItem = {
  id: PageId
  labelKey: string
  hintKey: string
  icon: ReactNode
}

const WORKSPACE_NAV: NavItem[] = [
  {
    id: "overview",
    labelKey: "nav.overview",
    hintKey: "nav.overviewHint",
    icon: <HardDriveIcon />,
  },
  {
    id: "files",
    labelKey: "nav.files",
    hintKey: "nav.filesHint",
    icon: <FolderTreeIcon />,
  },
  {
    id: "remotes",
    labelKey: "nav.remotes",
    hintKey: "nav.remotesHint",
    icon: <KeyRoundIcon />,
  },
  {
    id: "transfers",
    labelKey: "nav.transfers",
    hintKey: "nav.transfersHint",
    icon: <RefreshCcwIcon />,
  },
  {
    id: "mounts",
    labelKey: "nav.mounts",
    hintKey: "nav.mountsHint",
    icon: <CableIcon />,
  },
]

const SYSTEM_NAV: NavItem[] = [
  {
    id: "settings",
    labelKey: "nav.settings",
    hintKey: "nav.settingsHint",
    icon: <SettingsIcon />,
  },
  {
    id: "api",
    labelKey: "nav.api",
    hintKey: "nav.apiHint",
    icon: <TerminalSquareIcon />,
  },
]

const ALL_NAV = [...WORKSPACE_NAV, ...SYSTEM_NAV]

/**
 * 顶栏高度按平台区分：macOS 隐藏了标题栏，红绿灯与顶栏共用一行，需要更高；
 * Windows / Linux 使用系统原生的桌面 header 高度，保持与常见应用一致。
 */
const headerHeight = isMacDesktop ? "h-12" : isDesktop ? "h-10" : "h-14 md:h-12"

export function AppShell({
  page,
  onPageChange,
  children,
}: {
  page: PageId
  onPageChange: (page: PageId) => void
  children: ReactNode
}) {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const status = useRcloneStore((state) => state.status)
  const busy = useRcloneStore((state) => state.busy)
  const start = useRcloneStore((state) => state.start)
  const stop = useRcloneStore((state) => state.stop)
  // 收起后侧边栏只保留图标 Roman（activitybar），再收一次不隐藏。
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => startRcloneStatusPolling(), [])

  const running = status?.running ?? false
  const offline = status === null
  const current = ALL_NAV.find((item) => item.id === page)
  const nextLocale: Locale = i18n.language.startsWith("zh") ? "en" : "zh"

  return (
    <div className="flex h-svh bg-background text-foreground select-none">
      {/* 侧边栏：collapse 后保留图标 activitybar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
          sidebarCollapsed ? "w-12" : "w-60"
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 border-b px-2 [--wails-draggable:drag]",
            headerHeight,
            // macOS 无边框：为原生"红绿灯"按钮留出左上角空间（展开态）
            !sidebarCollapsed && isMacDesktop && "pl-[84px]"
          )}
        >
          {sidebarCollapsed ? null : (
            <>
              <span
                className="grid size-5 shrink-0 place-items-center rounded bg-primary text-[9px] font-semibold text-primary-foreground"
                aria-hidden
              >
                O
              </span>
              <span className="truncate font-heading text-xs font-semibold tracking-tight">
                Ourboros
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6 text-sidebar-foreground/70 hover:text-sidebar-foreground [&>svg]:size-3.5"
                aria-label={t("shell.collapseSidebar")}
                onClick={() => setSidebarCollapsed(true)}
              >
                <PanelLeftCloseIcon />
              </Button>
            </>
          )}
        </div>

        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-1.5 pt-1.5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6 text-sidebar-foreground/70 hover:text-sidebar-foreground [&>svg]:size-3.5"
              aria-label={t("shell.expandSidebar")}
              onClick={() => setSidebarCollapsed(false)}
            >
              <PanelLeftOpenIcon />
            </Button>
            <span
              className="grid size-5 place-items-center rounded bg-primary text-[9px] font-semibold text-primary-foreground"
              aria-hidden
            >
              O
            </span>
          </div>
        ) : null}

        <nav
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1.5",
            !sidebarCollapsed && "p-2"
          )}
          aria-label={t("nav.mainNav")}
        >
          <NavGroup
            items={WORKSPACE_NAV}
            page={page}
            onSelect={onPageChange}
            compact={sidebarCollapsed}
          />
          <div className="mt-auto flex flex-col gap-0.5 pt-2">
            {sidebarCollapsed ? (
              <div className="mx-2 mb-1 border-t border-sidebar-border" aria-hidden />
            ) : (
              <div className="pt-2">
                <span className="px-2.5 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground">
                  {t("nav.system")}
                </span>
              </div>
            )}
            <NavGroup
              items={SYSTEM_NAV}
              page={page}
              onSelect={onPageChange}
              compact={sidebarCollapsed}
            />
          </div>
        </nav>
      </aside>

      {/* 主窗口：自己的 header（当前页标题 + 操作） */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/40">
        <header
          className={cn(
            "flex shrink-0 items-center justify-between gap-3 border-b bg-background px-3 [--wails-draggable:drag]",
            headerHeight
          )}
        >
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 overflow-hidden",
              // macOS 隐藏标题栏后红绿灯位于左上角，内容需要让出空间（窄屏侧边栏隐藏时）
              isMacDesktop && "pl-[72px] md:pl-0"
            )}
          >
            {/* 移动端：侧边栏不可见，品牌放在主 header 左侧 */}
            <span
              className="grid size-5 shrink-0 place-items-center rounded bg-primary text-[9px] font-semibold text-primary-foreground md:hidden"
              aria-hidden
            >
              O
            </span>
            <span className="font-heading text-xs font-semibold tracking-tight md:hidden">
              Ourboros
            </span>
            <h2
              className="hidden truncate text-sm font-semibold tracking-tight md:block"
              title={current?.hintKey ? t(current.hintKey) : undefined}
            >
              {current ? t(current.labelKey) : ""}
            </h2>
            {current?.hintKey ? (
              <p className="hidden truncate text-xs text-muted-foreground lg:inline">
                {t(current.hintKey)}
              </p>
            ) : null}
            <div className="hidden min-w-0 shrink-0 overflow-hidden sm:block">
              <RcloneStatusPill offline={offline} running={running} status={status} />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 [--wails-draggable:no-drag]">
            {!offline ? (
              <Button
                variant="outline"
                size="xs"
                disabled={busy}
                onClick={() => void (running ? stop() : start())}
                aria-label={running ? t("shell.stopRclone") : t("shell.startRclone")}
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
              aria-label={theme === "dark" ? t("shell.toLight") : t("shell.toDark")}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </Button>
          </div>
        </header>

        {/* 移动端横向导航 */}
        <div className="w-full shrink-0 border-b md:hidden">
          <nav className="flex gap-1.5 overflow-x-auto p-2" aria-label={t("nav.mainNav")}>
            {ALL_NAV.map((item) => (
              <Button
                key={item.id}
                variant={page === item.id ? "secondary" : "ghost"}
                size="sm"
                className="shrink-0"
                aria-current={page === item.id ? "page" : undefined}
                onClick={() => onPageChange(item.id)}
              >
                {t(item.labelKey)}
              </Button>
            ))}
          </nav>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-5 pb-12 select-text">
            {children}
          </div>
        </ScrollArea>
      </main>
    </div>
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
      {running && status?.version ? (
        <span className="hidden truncate text-xs text-muted-foreground sm:inline">
          {status.version}
          {status.os && status.arch ? ` · ${status.os}/${status.arch}` : ""}
          {status.beta ? " · beta" : ""}
        </span>
      ) : null}
    </div>
  )
}

function NavGroup({
  items,
  page,
  onSelect,
  compact,
}: {
  items: NavItem[]
  page: PageId
  onSelect: (page: PageId) => void
  /** collapse 后只保留图标（activitybar 模式）。 */
  compact?: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
      {items.map((item) => {
        const active = page === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={active ? "page" : undefined}
            title={compact ? t(item.labelKey) : undefined}
            aria-label={compact ? t(item.labelKey) : undefined}
            className={cn(
              "flex shrink-0 items-center rounded-lg text-sm text-sidebar-foreground/70 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
              compact
                ? "mx-auto size-9 justify-center"
                : "w-full gap-2.5 px-2.5 py-2 text-left",
              active &&
                "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            )}
          >
            <span
              className={cn(
                "opacity-80 [&>svg]:size-4",
                active && "text-sidebar-primary opacity-100"
              )}
            >
              {item.icon}
            </span>
            {!compact ? t(item.labelKey) : null}
          </button>
        )
      })}
    </>
  )
}
