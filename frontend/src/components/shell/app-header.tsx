import { useTranslation } from "react-i18next"
import {
  Loader2Icon,
  MoonIcon,
  PlayIcon,
  RefreshCcwIcon,
  SquareIcon,
  SunIcon,
} from "lucide-react"

import { CommandPalette } from "@/components/command-palette"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { changeLanguage, type Locale } from "@/i18n"
import { isDesktop, isMacDesktop } from "@/lib/platform"
import type { RcloneStatus } from "@/lib/types"
import { useRcloneStore } from "@/stores/rclone-store"
import { cn } from "cn"

/**
 * 顶栏高度按平台区分：macOS 隐藏了标题栏，红绿灯与顶栏共用一行，需要更高；
 * Windows / Linux 使用系统原生的桌面 header 高度，保持与常见应用一致。
 */
const headerHeight = isMacDesktop ? "h-12" : isDesktop ? "h-10" : "h-14 md:h-12"

/** 顶栏：品牌、rclone 全局状态、快捷命令与主题 / 语言切换。 */
export function AppHeader() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const status = useRcloneStore((state) => state.status)
  const busy = useRcloneStore((state) => state.busy)
  const start = useRcloneStore((state) => state.start)
  const stop = useRcloneStore((state) => state.stop)

  const running = status?.running ?? false
  const offline = status === null
  const nextLocale: Locale = i18n.language.startsWith("zh") ? "en" : "zh"

  return (
    <header
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 border-b bg-background px-3 [--wails-draggable:drag]",
        headerHeight,
        isMacDesktop && "pl-[84px]"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
        <span
          className="grid size-5 shrink-0 place-items-center rounded-md bg-primary text-[9px] font-bold text-primary-foreground"
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
        <CommandPalette />

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
          aria-label={theme === "dark" ? t("shell.toLight") : t("shell.toDark")}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </Button>
      </div>
    </header>
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
