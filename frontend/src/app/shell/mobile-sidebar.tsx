import { useEffect, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

/**
 * 移动端（md 以下）抽屉式侧边栏：从左滑出，覆盖在内容之上。
 * 复用桌面 <Sidebar collapsed={false}> 的内容；点击导航链接、背景
 * 或按 Esc 关闭。桌面布局不渲染它。
 */
export function MobileSidebar({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!open) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  if (!open) {
    return null
  }

  return (
    <div className="md:hidden">
      <div
        aria-hidden
        className="fixed inset-0 z-40 animate-in bg-black/40 duration-200 fade-in-0"
        onClick={() => onOpenChange(false)}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.mainNav")}
        className="fixed inset-y-0 left-0 z-50 w-64 animate-in bg-sidebar shadow-xl duration-200 outline-none slide-in-from-left"
        onClick={(event) => {
          // 点到导航链接即完成一次跳转，顺势收起抽屉。
          if ((event.target as HTMLElement).closest("a")) {
            onOpenChange(false)
          }
        }}
      >
        {children}
      </aside>
    </div>
  )
}
