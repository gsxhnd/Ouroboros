import { NavLink } from "react-router"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", labelKey: "nav.home", end: true },
  { to: "/library", labelKey: "nav.library" },
  { to: "/system", labelKey: "nav.system" },
  { to: "/settings", labelKey: "nav.settings" },
] as const

export function PrimaryPanel() {
  const { t } = useTranslation()

  return (
    <aside className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-3">
        <p className="text-xs font-medium tracking-wide text-sidebar-foreground/70 uppercase">
          {t("layout.primary.title")}
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={"end" in item ? item.end : false}
            className={({ isActive }: { isActive: boolean }) =>
              cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )
            }
          >
            {t(item.labelKey)}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
