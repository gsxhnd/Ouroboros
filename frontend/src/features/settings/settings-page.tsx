import { useTranslation } from "react-i18next"
import { NavLink, Outlet } from "react-router"
import { CableIcon, CommandIcon, ServerIcon } from "lucide-react"

import { PageHeader } from "@/components/common/page-header"
import { cn } from "cn"

/** 设置页的二级分区：顺序即导航顺序，路径是 /settings 下的子路由。 */
const SECTIONS = [
  {
    path: "connection",
    labelKey: "settings.sections.connection",
    icon: CableIcon,
  },
  {
    path: "shortcuts",
    labelKey: "settings.sections.shortcuts",
    icon: CommandIcon,
  },
  {
    path: "runtime",
    labelKey: "settings.sections.runtime",
    icon: ServerIcon,
  },
]

/**
 * 设置页布局：左侧分区导航（NavLink 指向子路由），
 * 右侧内容区由 <Outlet /> 渲染 connection / shortcuts / runtime。
 */
export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4 md:p-6">
      <PageHeader
        title={t("nav.settings")}
        description={t("nav.settingsHint")}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row sm:gap-4">
        <aside className="shrink-0 border-b bg-muted/20 p-2 sm:w-52 sm:rounded-xl sm:border sm:p-3">
          <p className="hidden px-2 pt-1 pb-2 text-xs font-medium tracking-wide text-muted-foreground sm:block">
            {t("settings.categories")}
          </p>
          <nav
            className="flex gap-1 overflow-x-auto sm:flex-col"
            aria-label={t("settings.categories")}
          >
            {SECTIONS.map(({ path, labelKey, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    isActive
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{t(labelKey)}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-1">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
