import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { NavLink } from "react-router"
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { NAV_GROUPS } from "@/lib/nav"
import { cn } from "cn"

/**
 * 侧边栏折叠状态的 localStorage 键，与 ourboros.lang 等应用级键共用前缀。
 */
const sidebarStorageKey = "ourboros.sidebar"

/**
 * 主导航：按「工作区 / 系统」分组排序。激活项由路由位置决定，
 * 折叠时只显示图标并用 title 提示名称。
 */
export function Sidebar() {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(sidebarStorageKey) === "collapsed"
  )

  const toggleSidebar = () =>
    setCollapsed((current) => {
      const next = !current
      localStorage.setItem(sidebarStorageKey, next ? "collapsed" : "expanded")
      return next
    })

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-e bg-sidebar transition-[width] [--wails-draggable:no-drag]",
        collapsed ? "w-12" : "w-52"
      )}
    >
      <nav
        aria-label={t("nav.mainNav")}
        className="flex min-h-0 flex-1 flex-col gap-3 p-2"
      >
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.id} className="flex min-w-0 flex-col gap-1">
            {collapsed ? (
              groupIndex > 0 ? (
                <span
                  className="mx-auto my-1.5 h-px w-6 bg-border"
                  aria-hidden
                />
              ) : null
            ) : (
              <p className="px-2.5 pt-1 pb-0.5 text-[11px] font-medium tracking-wider text-muted-foreground/80 uppercase">
                {t(group.labelKey)}
              </p>
            )}
            {group.items.map((item) => (
              <SidebarItem
                key={item.path}
                path={item.path}
                label={t(item.labelKey)}
                icon={<item.icon className="size-4 shrink-0" />}
                collapsed={collapsed}
              />
            ))}
          </div>
        ))}
      </nav>
      <div
        className={cn("flex p-2", collapsed ? "justify-center" : "justify-end")}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={
            collapsed ? t("shell.expandSidebar") : t("shell.collapseSidebar")
          }
          title={
            collapsed ? t("shell.expandSidebar") : t("shell.collapseSidebar")
          }
          onClick={toggleSidebar}
        >
          {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
        </Button>
      </div>
    </aside>
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
            variant: isActive ? "secondary" : "ghost",
            size: "sm",
          }),
          "relative w-full text-muted-foreground hover:text-foreground",
          collapsed ? "justify-center px-0" : "justify-start gap-2.5 px-2.5"
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <span
              className="absolute start-0 h-4 w-0.5 rounded-full bg-primary"
              aria-hidden
            />
          ) : null}
          {icon}
          {!collapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  )
}
