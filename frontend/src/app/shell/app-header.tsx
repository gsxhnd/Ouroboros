import { useTranslation } from "react-i18next"
import {
  MenuIcon,
  MoonIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SunIcon,
} from "lucide-react"

import { CommandPalette } from "@/app/shell/command-palette"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/app/providers/theme-provider"
import { Separator } from "@/components/ui/separator"
import { isDesktop, os, type Os } from "@/lib/platform"
import { cn } from "cn"

/**
 * 各桌面操作系统的顶栏高度（浏览器走响应式高度，不在此列）。
 * 侧边栏贯穿全高、红绿灯由侧边栏顶部的空条承载后，顶栏只是主区列的
 * 工具行，按各平台习惯的密度取值即可。
 */
const DESKTOP_HEADER_HEIGHTS: Partial<Record<Os, string>> = {
  macos: "h-8",
  windows: "h-10",
  linux: "h-10",
}

const headerHeight = isDesktop
  ? (DESKTOP_HEADER_HEIGHTS[os] ?? "h-10")
  : "h-14 md:h-12"

/**
 * 顶栏：左侧是侧边栏开关（桌面折叠 / 展开，移动端唤出抽屉），右侧一簇
 * 快捷控制（命令面板、主题切换）。品牌不占顶栏（窗口身份交给系统标题栏），
 * rclone 启停归概览页与命令面板，服务状态常驻侧边栏底部，语言切换收进
 * 命令面板。顶栏与主区同底色（bg-muted/40），底边一条分隔线把工具行和
 * 内容分开，中间留白即窗口拖拽区。
 */
export function AppHeader({
  sidebarCollapsed,
  onToggleSidebar,
  mobile = false,
}: {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  /** 移动端（md 以下）：侧边栏开关变成唤出抽屉的菜单按钮。 */
  mobile?: boolean
}) {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const sidebarLabel = mobile
    ? t("shell.openMenu")
    : sidebarCollapsed
      ? t("shell.expandSidebar")
      : t("shell.collapseSidebar")

  return (
    <header
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 border-b bg-muted/40 px-3",
        headerHeight,
        // 拖拽区只属于桌面形态；浏览器 DOM 不携带 --wails-draggable。
        isDesktop && "[--wails-draggable:drag]"
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 [--wails-draggable:no-drag]"
        aria-label={sidebarLabel}
        title={sidebarLabel}
        onClick={onToggleSidebar}
      >
        {mobile ? (
          <MenuIcon />
        ) : sidebarCollapsed ? (
          <PanelLeftOpenIcon />
        ) : (
          <PanelLeftCloseIcon />
        )}
      </Button>
      <div className="flex shrink-0 items-center gap-1 [--wails-draggable:no-drag]">
        <CommandPalette />

        <Separator orientation="vertical" className="mx-1 h-4" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={theme === "dark" ? t("shell.toLight") : t("shell.toDark")}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </Button>
      </div>
    </header>
  )
}
