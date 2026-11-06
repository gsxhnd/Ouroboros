import { useEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDownIcon, ChevronRightIcon, GripVerticalIcon } from "lucide-react"

import { cn } from "cn"

type Position = { x: number; y: number }

const STORAGE_KEY = "ourboros.canvas.panel"

function loadPosition(fallback: Position): Position {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return fallback
    }
    const parsed = JSON.parse(raw) as Partial<Position>
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return { x: parsed.x, y: parsed.y }
    }
  } catch {
    // localStorage 不可用或内容损坏时使用默认位置。
  }
  return fallback
}

/**
 * 画布上可拖动、可折叠的浮动面板（类似 ComfyUI 的节点库）。
 * 位置只是非敏感的界面偏好，保存在 localStorage。
 * 拖动期间直接修改 DOM 的 transform，避免每一帧触发 React 渲染。
 */
export function FloatingPanel({
  title,
  initial,
  children,
  className,
}: {
  title: string
  initial: Position
  children: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position>(() => loadPosition(initial))
  const [collapsed, setCollapsed] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; origin: Position } | null>(null)
  const latestPosition = useRef(position)

  useEffect(() => {
    latestPosition.current = position
  }, [position])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origin: latestPosition.current,
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const panel = panelRef.current
    if (!drag || !panel) {
      return
    }
    const next = {
      x: drag.origin.x + event.clientX - drag.startX,
      y: drag.origin.y + event.clientY - drag.startY,
    }
    latestPosition.current = next
    panel.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`
  }

  const onPointerUp = () => {
    if (!dragRef.current) {
      return
    }
    dragRef.current = null
    const next = latestPosition.current
    setPosition(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 忽略存储失败，位置只在本次会话生效。
    }
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute top-0 left-0 z-40 flex w-56 flex-col overflow-hidden rounded-xl border bg-popover/95 text-sm text-popover-foreground shadow-lg backdrop-blur",
        className
      )}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      <div
        className="flex cursor-grab touch-none items-center gap-1 border-b px-2 py-1.5 select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <GripVerticalIcon className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{title}</span>
        <button
          type="button"
          className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-accent"
          aria-label={collapsed ? t("canvas.panel.expand") : t("canvas.panel.collapse")}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronRightIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
        </button>
      </div>
      {collapsed ? null : <div className="flex flex-col gap-1 p-1.5">{children}</div>}
    </div>
  )
}
