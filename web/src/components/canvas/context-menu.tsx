import { useEffect, useRef, type ReactNode } from "react"

export type ContextMenuItem =
  | { type: "separator" }
  | {
      type: "item"
      key: string
      label: string
      icon?: ReactNode
      disabled?: boolean
      destructive?: boolean
      onSelect: () => void
    }

/** 画布自绘右键菜单。位置为容器内的像素坐标。 */
export function CanvasContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("resize", onClose)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("resize", onClose)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute z-50 min-w-44 overflow-hidden rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md"
      style={{ left: x, top: y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item, index) =>
        item.type === "separator" ? (
          <div key={`sep-${index}`} role="separator" className="my-1 h-px bg-border" />
        ) : (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50 " +
              (item.destructive ? "text-destructive" : "")
            }
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            {item.icon ? <span className="[&>svg]:size-4">{item.icon}</span> : null}
            {item.label}
          </button>
        )
      )}
    </div>
  )
}
