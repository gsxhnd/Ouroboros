import { useEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  GaugeIcon,
  Loader2Icon,
  MoonIcon,
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
import { OverviewPage } from "@/pages/overview"
import { SettingsPage } from "@/pages/settings"
import { startRcloneStatusPolling, useRcloneStore } from "@/stores/rclone-store"
import type { RcloneStatus } from "@/lib/types"
import { cn } from "cn"

/**
 * 顶栏高度按平台区分：macOS 隐藏了标题栏，红绿灯与顶栏共用一行，需要更高；
 * Windows / Linux 使用系统原生的桌面 header 高度，保持与常见应用一致。
 */
const headerHeight = isMacDesktop ? "h-12" : isDesktop ? "h-10" : "h-14 md:h-12"

/**
 * 应用外壳：画布始终是唯一的主视图，
 * 概览、设置和接口演示以浮层形式打开，不再切换页面。
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

        <nav
          className="flex shrink-0 items-center gap-1 [--wails-draggable:no-drag]"
          aria-label={t("nav.mainNav")}
        >
          <CommandPalette
            isDark={theme === "dark"}
            isRunning={running}
            isMac={isMacDesktop}
            onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
            onToggleLanguage={() => changeLanguage(nextLocale)}
            onToggleRclone={() => void (running ? stop() : start())}
            onOpenOverview={() => setOverviewOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenApi={() => setApiOpen(true)}
          />
          <HeaderPopover
            open={overviewOpen}
            onOpenChange={setOverviewOpen}
            label={t("nav.overview")}
            icon={<GaugeIcon />}
          >
            <OverviewPage />
          </HeaderPopover>

          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("nav.settings")}
            title={t("nav.settings")}
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("nav.api")}
            title={t("nav.api")}
            onClick={() => setApiOpen(true)}
          >
            <TerminalSquareIcon />
          </Button>

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
        </nav>
      </header>

      <main className="flex min-h-0 flex-1 flex-col bg-muted/40 p-3">
        {children}
      </main>

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

/** 顶栏按钮下方展开的内容浮层，点击外部或按 Esc 关闭。 */
function HeaderPopover({
  open,
  onOpenChange,
  label,
  icon,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  icon: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false)
      }
    }
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onOpenChange])

  return (
    <div ref={ref} className="relative">
      <Button
        variant={open ? "secondary" : "ghost"}
        size="icon-xs"
        aria-label={label}
        title={label}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        {icon}
      </Button>
      {open ? (
        <div className="absolute end-0 top-full z-50 mt-1 max-h-[min(78vh,40rem)] w-[min(92vw,44rem)] overflow-y-auto rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg select-text">
          <div className="flex flex-col gap-3">{children}</div>
        </div>
      ) : null}
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
    </div>
  )
}
