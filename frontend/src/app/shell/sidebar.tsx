import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { NavLink } from "react-router"

import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { NAV_GROUPS, PINNED_NAV_ITEMS } from "@/app/nav"
import { isMacDesktop } from "@/lib/platform"
import { useRcloneStore } from "@/stores/rclone-store"
import { cn } from "cn"

/**
 * 主导航：按「工作区 / 系统」分组排序，激活项由路由位置决定，折叠时只
 * 显示图标并用 title 提示名称。展开 / 收起开关在顶栏（AppHeader）上，
 * 侧边栏自身只保留 mac 顶部的红绿灯空条；底部钉住设置入口与服务状态。
 */
export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation()

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col overflow-hidden bg-sidebar [--wails-draggable:no-drag]",
        // 展开态的分隔线由相邻的 ResizableHandle 提供；折叠轨没有手柄。
        collapsed ? "w-12 shrink-0 border-e" : "h-full w-full"
      )}
    >
      {isMacDesktop ? (
        // 红绿灯空条：系统把按钮固定居中在 28px 隐形标题栏内（Wails 无法
        // 移动），同高即视觉居中，兼作窗口拖拽热区。
        <div className="h-7 shrink-0 [--wails-draggable:drag]" aria-hidden />
      ) : null}
      <nav
        aria-label={t("nav.mainNav")}
        className="flex min-h-0 flex-1 flex-col gap-3 p-2"
      >
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.id} className="flex min-w-0 flex-col gap-1">
            {collapsed ? (
              groupIndex > 0 ? (
                <Separator className="mx-auto my-1.5 w-6" />
              ) : null
            ) : (
              <p className="px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                {t(group.labelKey)}
              </p>
            )}
            {group.items
              .filter((item) => !item.pinned)
              .map((item) => (
                <SidebarItem
                  key={item.path}
                  path={item.path}
                  label={t(item.labelKey)}
                  icon={<item.icon />}
                  collapsed={collapsed}
                />
              ))}
          </div>
        ))}
      </nav>
      <div className="flex shrink-0 flex-col gap-1 border-t p-2">
        {PINNED_NAV_ITEMS.map((item) => (
          <SidebarItem
            key={item.path}
            path={item.path}
            label={t(item.labelKey)}
            icon={<item.icon />}
            collapsed={collapsed}
          />
        ))}
        <SidebarStatus collapsed={collapsed} />
      </div>
    </aside>
  )
}

/**
 * 侧边栏底部的常驻 rclone 服务状态（原底部状态条并入这里）；
 * 折叠轨里只保留状态圆点。
 */
function SidebarStatus({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation()
  const status = useRcloneStore((state) => state.status)

  const offline = status === null
  const running = status?.running ?? false

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
      ? "bg-success"
      : "bg-warning"

  if (collapsed) {
    return (
      <div className="flex justify-center p-1.5">
        <span
          className={cn("size-2 rounded-full", dotClass)}
          role="status"
          aria-label={label}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 px-2.5 py-1.5 text-xs text-muted-foreground">
      <div
        className="flex min-w-0 items-center gap-2"
        role="status"
        aria-live="polite"
      >
        <span
          className={cn("size-2 shrink-0 rounded-full", dotClass)}
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </div>
      {status?.version ? (
        <span className="truncate">
          {t("shell.rcloneVersion", { version: status.version })}
          {status.mode ? ` · ${t(`overview.mode.${status.mode}`)}` : ""}
        </span>
      ) : null}
    </div>
  )
}

/** 导航项：真实 <a> 链接由 NavLink 渲染，激活态借用按钮样式保持一致的视觉密度。 */
function SidebarItem({
  path,
  label,
  icon,
  collapsed,
}: {
  path: string
  label: string
  icon: ReactNode
  collapsed: boolean
}) {
  return (
    <NavLink
      to={path}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          buttonVariants({
            variant: "ghost",
            size: "sm",
          }),
          "w-full",
          collapsed ? "justify-center px-0" : "justify-start px-2.5",
          isActive
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            : "text-muted-foreground"
        )
      }
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}
