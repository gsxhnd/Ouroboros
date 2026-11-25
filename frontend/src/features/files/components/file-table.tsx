import { useTranslation } from "react-i18next"
import {
  ArrowUpIcon,
  CopyIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  MoveIcon,
  PenLineIcon,
  TrashIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ListItem } from "@/lib/types"
import { itemName } from "@/features/files/file-paths"
import { formatBytes } from "@/lib/format"
import { cn } from "cn"

export type SortKey = "name" | "size" | "mod_time"

/** 列表头部可点击的排序键定义。 */
const sortColumns: {
  labelKey: string
  sortKey: SortKey
}[] = [
  { labelKey: "common.name", sortKey: "name" },
  { labelKey: "files.columnSize", sortKey: "size" },
  { labelKey: "files.columnModified", sortKey: "mod_time" },
]

/** 文件列表：目录优先由父级排序后传入，行内提供下载 / 重命名 / 复制 / 移动 / 删除。 */
export function FileTable({
  items,
  sortKey,
  sortDir,
  onToggleSort,
  onEnterDir,
  onDownload,
  onRename,
  onCopy,
  onMove,
  onDelete,
}: {
  items: ListItem[]
  sortKey: SortKey
  sortDir: "asc" | "desc"
  onToggleSort: (key: SortKey) => void
  onEnterDir: (name: string) => void
  onDownload: (item: ListItem) => void
  onRename: (item: ListItem) => void
  onCopy: (item: ListItem) => void
  onMove: (item: ListItem) => void
  onDelete: (item: ListItem) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] table-fixed text-sm">
        <thead>
          <tr className="border-y text-left text-xs text-muted-foreground">
            {sortColumns.map((column) => {
              const active = column.sortKey === sortKey
              return (
                <th
                  key={column.sortKey}
                  className={cn(
                    "px-3 py-2 font-medium",
                    column.sortKey === "size" && "w-24",
                    column.sortKey === "mod_time" && "w-44"
                  )}
                  aria-sort={
                    active
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1 hover:text-foreground",
                      active && "text-foreground"
                    )}
                    onClick={() => onToggleSort(column.sortKey)}
                  >
                    {t(column.labelKey)}
                    {column.sortKey === "name" || active ? (
                      <ArrowUpIcon
                        className={cn(
                          "size-3",
                          !active && "opacity-0",
                          active && sortDir === "desc" && "rotate-180"
                        )}
                      />
                    ) : null}
                  </button>
                </th>
              )
            })}
            <th className="w-44 px-3 py-2 font-medium">
              {t("common.actions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const name = itemName(item)
            return (
              <tr
                key={name}
                className="border-b transition-colors last:border-b-0 hover:bg-muted/50"
              >
                <td className="overflow-hidden px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {item.is_dir ? (
                      <FolderIcon className="size-4 shrink-0 text-primary" />
                    ) : (
                      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    {item.is_dir ? (
                      <Button
                        variant="link"
                        size="xs"
                        className="min-w-0 shrink justify-start px-0"
                        title={name}
                        onClick={() => onEnterDir(name)}
                      >
                        <span className="truncate">{name}</span>
                      </Button>
                    ) : (
                      <span className="truncate font-mono text-xs" title={name}>
                        {name}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                  {item.is_dir ? "—" : formatBytes(item.size)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {item.mod_time
                    ? new Date(item.mod_time).toLocaleString()
                    : "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex gap-1">
                    {!item.is_dir ? (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t("files.downloadFile")}
                        title={t("files.downloadFile")}
                        onClick={() => onDownload(item)}
                      >
                        <DownloadIcon />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("files.rename")}
                      title={t("files.rename")}
                      onClick={() => onRename(item)}
                    >
                      <PenLineIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("common.copy")}
                      title={t("common.copy")}
                      onClick={() => onCopy(item)}
                    >
                      <CopyIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("common.move")}
                      title={t("common.move")}
                      onClick={() => onMove(item)}
                    >
                      <MoveIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("common.delete")}
                      title={t("common.delete")}
                      onClick={() => onDelete(item)}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
