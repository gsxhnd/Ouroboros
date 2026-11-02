import { useEffect, type ReactNode } from "react"
import {
  CableIcon,
  FolderTreeIcon,
  HardDriveIcon,
  KeyRoundIcon,
  Loader2Icon,
  MoonIcon,
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
import { isMacDesktop } from "@/lib/platform"
import { startRcloneStatusPolling, useRcloneStore } from "@/lib/rclone-store"
import type { RcloneStatus } from "@/lib/types"
import { cn } from "cn"

export type PageId =
  "overview" | "files" | "remotes" | "transfers" | "mounts" | "settings" | "api"

type NavItem = { id: PageId; label: string; icon: ReactNode; hint: string }

const WORKSPACE_NAV: NavItem[] = [
  {
    id: "overview",
    label: "概览",
    icon: <HardDriveIcon />,
    hint: "rclone 状态与控制",
  },
  {
    id: "files",
    label: "文件",
    icon: <FolderTreeIcon />,
    hint: "浏览与文件操作",
  },
  {
    id: "remotes",
    label: "远程",
    icon: <KeyRoundIcon />,
    hint: "管理 rclone remotes",
  },
  {
    id: "transfers",
    label: "同步任务",
    icon: <RefreshCcwIcon />,
    hint: "连接与同步任务",
  },
  {
    id: "mounts",
    label: "挂载",
    icon: <CableIcon />,
    hint: "远程挂载到本地",
  },
]

const SYSTEM_NAV: NavItem[] = [
  {
    id: "settings",
    label: "设置",
    icon: <SettingsIcon />,
    hint: "endpoint 与 rclone 配置",
  },
  {
    id: "api",
    label: "接口演示",
    icon: <TerminalSquareIcon />,
    hint: "全部 HTTP 接口",
  },
]

const ALL_NAV = [...WORKSPACE_NAV, ...SYSTEM_NAV]

export function AppShell({
  page,
  onPageChange,
  children,
}: {
  page: PageId
  onPageChange: (page: PageId) => void
  children: ReactNode
}) {
  const { theme, setTheme } = useTheme()
  const status = useRcloneStore((state) => state.status)
  const busy = useRcloneStore((state) => state.busy)
  const start = useRcloneStore((state) => state.start)
  const stop = useRcloneStore((state) => state.stop)

  useEffect(() => startRcloneStatusPolling(), [])

  const running = status?.running ?? false
  const offline = status === null
  const current = ALL_NAV.find((item) => item.id === page)

  return (
    <div className="flex h-svh flex-col bg-background text-foreground select-none">
      <header
        className={cn(
          "flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 [--wails-draggable:drag]",
          // macOS 无边框：为原生"红绿灯"按钮留出左上角空间
          isMacDesktop && "pl-[84px]"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
          <span
            className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground"
            aria-hidden
          >
            O
          </span>
          <span className="font-heading text-sm font-semibold tracking-tight">
            Ourboros
          </span>
          <RcloneStatusPill
            offline={offline}
            running={running}
            status={status}
          />
        </div>

        {!offline ? (
          <Button
            variant="outline"
            size="sm"
            className="[--wails-draggable:no-drag]"
            disabled={busy}
            onClick={() => void (running ? stop() : start())}
            aria-label={running ? "停止 rclone" : "启动 rclone"}
          >
            {busy ? (
              <Loader2Icon className="animate-spin" />
            ) : running ? (
              <SquareIcon />
            ) : (
              <PlayIcon />
            )}
            {running ? "停止" : "启动"}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="[--wails-draggable:no-drag]"
            onClick={() => void useRcloneStore.getState().refresh()}
          >
            <RefreshCcwIcon />
            重试连接
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="size-8 [--wails-draggable:no-drag]"
          aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
          <nav
            className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2"
            aria-label="主导航"
          >
            <NavGroup
              title="工作区"
              items={WORKSPACE_NAV}
              page={page}
              onSelect={onPageChange}
            />
            <div className="mt-auto flex flex-col gap-0.5 pt-4">
              <NavGroup
                title="系统"
                items={SYSTEM_NAV}
                page={page}
                onSelect={onPageChange}
              />
            </div>
          </nav>
        </aside>

        <div className="w-full shrink-0 border-b md:hidden">
          <nav className="flex gap-1.5 overflow-x-auto p-2" aria-label="主导航">
            {ALL_NAV.map((item) => (
              <Button
                key={item.id}
                variant={page === item.id ? "secondary" : "ghost"}
                size="sm"
                className="shrink-0"
                aria-current={page === item.id ? "page" : undefined}
                onClick={() => onPageChange(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </nav>
        </div>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/40">
          <div className="flex flex-col gap-0.5 border-b bg-background/80 px-5 py-4 [--wails-draggable:drag]">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              {current?.label ?? ""}
            </h2>
            {current?.hint ? (
              <p className="text-sm text-muted-foreground">{current.hint}</p>
            ) : null}
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-5 pb-12 select-text">
              {children}
            </div>
          </ScrollArea>
        </main>
      </div>
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
  const label = offline
    ? "服务离线"
    : running
      ? status?.mode === "attached"
        ? "rclone 已连接"
        : "rclone 运行中"
      : "rclone 已停止"
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
  title,
  items,
  page,
  onSelect,
}: {
  title: string
  items: NavItem[]
  page: PageId
  onSelect: (page: PageId) => void
}) {
  return (
    <>
      <span className="px-2.5 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground">
        {title}
      </span>
      {items.map((item) => {
        const active = page === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-sidebar-foreground/70 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
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
            {item.label}
          </button>
        )
      })}
    </>
  )
}
