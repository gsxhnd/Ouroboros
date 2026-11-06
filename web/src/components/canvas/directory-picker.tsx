import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronRightIcon, FolderIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { callQuiet } from "@/lib/client"
import type { FilesResponse, ListItem, SystemInfo } from "@/lib/types"
import { cn } from "cn"

/** 把绝对路径拆成可点击的面包屑段。 */
function splitPath(path: string): { name: string; path: string }[] {
  const windows = /^[A-Za-z]:/.test(path)
  const separator = windows ? "\\" : "/"
  const parts = path.split(/[\\/]+/).filter(Boolean)
  const crumbs: { name: string; path: string }[] = []
  if (!windows) {
    crumbs.push({ name: "/", path: "/" })
  }
  let current = ""
  for (const [index, part] of parts.entries()) {
    if (index === 0 && windows) {
      current = `${part}${separator}`
    } else {
      current = `${current.replace(/[\\/]$/, "")}${separator}${part}`
    }
    crumbs.push({ name: part, path: current })
  }
  return crumbs
}

/**
 * 选择本地目录：点击路径中的任意一级即可跳转，下方列出当前目录的子文件夹。
 * 目前后端通过 rclone 列目录，因此 rclone 未运行时会显示错误。
 */
export function DirectoryPicker({
  open,
  initial,
  onOpenChange,
  onPick,
}: {
  open: boolean
  initial: string
  onOpenChange: (open: boolean) => void
  onPick: (path: string) => void
}) {
  const { t } = useTranslation()
  const [current, setCurrent] = useState("")
  const [items, setItems] = useState<ListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const navigate = async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await callQuiet<FilesResponse>(
        `/api/files?fs=${encodeURIComponent(path)}`
      )
      setCurrent(path)
      setItems(data.items.filter((item) => item.is_dir))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("errors.loadFailed"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) {
      return
    }
    const run = async () => {
      let start = initial.trim()
      if (!start) {
        try {
          const info = await callQuiet<SystemInfo>("/api/system/info")
          start = info.home_dir ?? "/"
        } catch {
          start = "/"
        }
      }
      await navigate(start)
    }
    void run()
    // 只在打开时初始化一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const crumbs = current ? splitPath(current) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("canvas.picker.title")}</DialogTitle>
          <DialogDescription>{t("canvas.picker.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-0.5 overflow-x-auto rounded-lg border bg-muted/40 px-2 py-1.5 font-mono text-xs whitespace-nowrap">
          {crumbs.map((crumb, index) => (
            <span key={crumb.path} className="flex items-center gap-0.5">
              {index > 0 ? (
                <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden />
              ) : null}
              <button
                type="button"
                className={cn(
                  "rounded px-1 py-0.5 hover:bg-accent hover:text-foreground",
                  index === crumbs.length - 1
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
                onClick={() => void navigate(crumb.path)}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        <div className="h-72 overflow-y-auto rounded-lg border">
          {loading ? (
            <p className="p-3 text-sm text-muted-foreground">{t("canvas.picker.loading")}</p>
          ) : error ? (
            <p className="p-3 text-sm text-destructive">{error}</p>
          ) : items.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{t("canvas.picker.empty")}</p>
          ) : (
            <ul className="flex flex-col">
              {items.map((item) => (
                <li key={item.name ?? ""}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => item.name && void navigate(joinPath(current, item.name))}
                  >
                    <FolderIcon className="size-4 text-muted-foreground" />
                    <span className="truncate">{item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
          <Button
            disabled={!current || Boolean(error) || loading}
            onClick={() => {
              onPick(current)
              onOpenChange(false)
            }}
          >
            {t("canvas.picker.select")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function joinPath(base: string, name: string) {
  const separator = base.includes("\\") && !base.includes("/") ? "\\" : "/"
  return `${base.replace(/[\\/]+$/, "")}${separator}${name}`
}
