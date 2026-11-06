import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ArrowUpIcon,
  ChevronRightIcon,
  CopyIcon,
  CornerLeftUpIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  FolderPlusIcon,
  HardDriveIcon,
  MoveIcon,
  PenLineIcon,
  RefreshCcwIcon,
  SearchIcon,
  TrashIcon,
} from "lucide-react"

import { EmptyHint, SelectField } from "@/components/shared"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { call, errorMessage, formatBytes } from "@/lib/client"
import { joinPath, parentPath, splitPath } from "@/lib/paths"
import type { FilesResponse, ListItem, RemoteInfo } from "@/lib/types"
import { cn } from "cn"
import { toast } from "sonner"

type TransferKind = "copy" | "move"

type TransferState = {
  kind: TransferKind
  item: ListItem
  target: string
}

type RenameState = {
  item: ListItem
  name: string
}

type SortKey = "name" | "size" | "mod_time"

/** 远程路径的上一级；根目录时返回空串。 */
function remoteParent(path: string): string {
  const index = path.lastIndexOf("/")
  return index < 0 ? "" : path.slice(0, index)
}

const join = (base: string, name: string | null) =>
  base ? `${base}/${name}` : (name ?? "")

/** 列表头部可点击的排序键定义。 */
const sortColumns: {
  labelKey: string
  sortKey: SortKey
  className?: string
}[] = [
  { labelKey: "common.name", sortKey: "name" },
  { labelKey: "files.columnSize", sortKey: "size" },
  {
    labelKey: "files.columnModified",
    sortKey: "mod_time",
    className: "hidden sm:table-cell",
  },
]

export function FilesPage() {
  const { t } = useTranslation()
  const [remotes, setRemotes] = useState<RemoteInfo[]>([])
  const [fsKind, setFsKind] = useState<"remote" | "local">("remote")
  const [remoteName, setRemoteName] = useState("")
  const [remotePath, setRemotePath] = useState("")
  const [localPath, setLocalPath] = useState("")
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [mkdirOpen, setMkdirOpen] = useState(false)
  const [mkdirName, setMkdirName] = useState("")
  const [transfer, setTransfer] = useState<TransferState | null>(null)
  const [rename, setRename] = useState<RenameState | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [filter, setFilter] = useState("")

  const currentFs = () => (fsKind === "remote" ? remoteName : localPath.trim())
  const currentRemote = () => (fsKind === "remote" ? remotePath : "")

  const loadRemotes = useCallback(async () => {
    try {
      const data = await call<{ remotes: RemoteInfo[] }>("/api/remotes")
      setRemotes(data.remotes)
      setRemoteName((current) => current || data.remotes[0]?.name || "")
    } catch {
      setRemotes([])
    }
  }, [])

  const list = useCallback(async () => {
    const fs = currentFs()
    if (!fs) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const query = new URLSearchParams({ fs, remote: currentRemote() })
      const data = await call<FilesResponse>(`/api/files?${query}`)
      setItems(data.items)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fsKind, remoteName, remotePath, localPath])

  useEffect(() => {
    const run = async () => {
      await loadRemotes()
    }
    void run()
  }, [loadRemotes])

  useEffect(() => {
    const run = async () => {
      await list()
    }
    void run()
  }, [list])

  /** 进入目录：远程模式拼到 remotePath，本地模式替换 localPath。 */
  const enterDir = (name: string) => {
    if (fsKind === "remote") {
      setRemotePath(join(remotePath, name))
    } else {
      setLocalPath(joinPath(localPath, name))
    }
  }

  /** 排序 + 名称过滤：目录永远排在文件前面。 */
  const visibleItems = useMemo(() => {
    const query = filter.trim().toLowerCase()
    const matched = items.filter((item) => {
      if (!query) {
        return true
      }
      const name = (item.name ?? item.path ?? "").toLowerCase()
      return name.includes(query)
    })
    const direction = sortDir === "asc" ? 1 : -1
    return [...matched].sort((a, b) => {
      const aDir = Boolean(a.is_dir)
      const bDir = Boolean(b.is_dir)
      if (aDir !== bDir) {
        return aDir ? -1 : 1
      }
      const compare = (() => {
        if (sortKey === "size") {
          return (a.size ?? 0) - (b.size ?? 0)
        }
        if (sortKey === "mod_time") {
          return (
            (a.mod_time ? Date.parse(a.mod_time) : 0) -
            (b.mod_time ? Date.parse(b.mod_time) : 0)
          )
        }
        return (a.name ?? a.path ?? "").localeCompare(b.name ?? b.path ?? "")
      })()
      return compare * direction
    })
  }, [items, filter, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const canGoUp =
    fsKind === "remote" ? remotePath !== "" : parentPath(localPath) !== localPath

  const goUp = () => {
    if (fsKind === "remote") {
      setRemotePath(remoteParent(remotePath))
    } else if (localPath.trim()) {
      setLocalPath(parentPath(localPath))
    }
  }

  const deleteItem = async (item: ListItem) => {
    const name = item.name ?? item.path ?? ""
    if (
      !window.confirm(
        item.is_dir
          ? t("files.deleteDirConfirm", { name })
          : t("files.deleteFileConfirm", { name })
      )
    ) {
      return
    }
    const params = new URLSearchParams({
      fs: currentFs(),
      remote: join(currentRemote(), name),
    })
    if (item.is_dir) {
      params.set("purge", "true")
    }
    try {
      await call(`/api/files?${params}`, { method: "DELETE" })
      toast.success(t("files.deleted", { name }))
      await list()
    } catch {
      toast.error(errorMessage(null))
    }
  }

  const mkdir = async () => {
    const name = mkdirName.trim()
    if (!name || name.includes("/")) {
      toast.error(t("files.nameInvalid"))
      return
    }
    await call("/api/files/mkdir", {
      method: "POST",
      body: {
        fs: currentFs(),
        remote: join(currentRemote(), name),
      },
    })
    toast.success(t("files.created", { name }))
    setMkdirOpen(false)
    setMkdirName("")
    await list()
  }

  const submitTransfer = async () => {
    if (!transfer) {
      return
    }
    const name = transfer.item.name ?? transfer.item.path ?? ""
    const target = transfer.target.trim()
    if (!target) {
      toast.error(t("files.targetRequired"))
      return
    }
    let dstFs: string
    let dstRemote: string | undefined
    if (target.startsWith("/")) {
      dstFs = target
      dstRemote = transfer.item.is_dir ? undefined : name
    } else {
      const [remote, ...rest] = target.split("/")
      dstFs = remote
      dstRemote = transfer.item.is_dir
        ? rest.join("/") || undefined
        : join(rest.join("/"), name)
    }
    await call(`/api/files/${transfer.kind}`, {
      method: "POST",
      body: {
        src_fs: currentFs(),
        src_remote: join(currentRemote(), name) || undefined,
        dst_fs: dstFs,
        dst_remote: dstRemote,
        directory: Boolean(transfer.item.is_dir),
      },
    })
    toast.success(
      t("files.submitted", {
        kind: transfer.kind === "copy" ? t("common.copy") : t("common.move"),
        name,
        target,
      })
    )
    setTransfer(null)
    await list()
  }

  /** 重命名：把文件/目录移动到同目录下的新名字。 */
  const submitRename = async () => {
    if (!rename) {
      return
    }
    const name = rename.item.name ?? rename.item.path ?? ""
    const target = rename.name.trim()
    if (!target || target.includes("/")) {
      toast.error(t("files.renameInvalid"))
      return
    }
    await call("/api/files/move", {
      method: "POST",
      body: {
        src_fs: currentFs(),
        src_remote: join(currentRemote(), name),
        dst_fs: currentFs(),
        dst_remote: join(currentRemote(), target),
        directory: Boolean(rename.item.is_dir),
      },
    })
    toast.success(t("files.renameDone", { name, target }))
    setRename(null)
    await list()
  }

  /** 下载单个文件：先探测接口，失败时提示后端给出的原因。 */
  const downloadItem = async (item: ListItem) => {
    const name = item.name ?? item.path ?? ""
    const params = new URLSearchParams({
      fs: currentFs(),
      remote: join(currentRemote(), name),
    })
    const url = `/api/files/download?${params}`
    try {
      const response = await fetch(url, { credentials: "same-origin" })
      if (!response.ok) {
        let payload: unknown = null
        if ((response.headers.get("content-type") ?? "").includes("json")) {
          payload = await response.json().catch(() => null)
        }
        toast.error(errorMessage(payload))
        return
      }
      // 取消刚才用于校验的请求体，真正的下载交给浏览器流式完成。
      await response.body?.cancel().catch(() => undefined)
      const link = document.createElement("a")
      link.href = url
      link.download = name
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      toast.error(errorMessage(null))
    }
  }

  const crumbs = remotePath ? remotePath.split("/") : []
  const localCrumbs = fsKind === "local" && localPath.trim() ? splitPath(localPath) : []

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("files.locationTitle")}</CardTitle>
          <CardDescription>{t("files.locationDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <SelectField
            label={t("files.source")}
            className="w-56"
            value={fsKind}
            options={[
              { value: "remote", label: t("files.sourceRemote") },
              { value: "local", label: t("files.sourceLocal") },
            ]}
            onChange={setFsKind}
          />
          {fsKind === "remote" ? (
            <SelectField
              label="remote"
              className="w-56"
              value={remoteName}
              options={remotes.map((r) => ({ value: r.name, label: r.name }))}
              onChange={(next) => {
                setRemoteName(next)
                setRemotePath("")
              }}
              disabled={remotes.length === 0}
              placeholder={remotes.length === 0 ? t("files.noRemotes") : undefined}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>{t("files.localDir")}</Label>
              <Input
                className="w-72 font-mono"
                placeholder="/absolute/path"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
              />
            </div>
          )}
          <Button size="sm" variant="outline" onClick={() => void list()}>
            <RefreshCcwIcon /> {t("common.refresh")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMkdirOpen(true)}>
            <FolderPlusIcon /> {t("files.newDir")}
          </Button>
        </CardContent>
      </Card>

      {items.length === 0 && !loading ? (
        <EmptyHint>{t("files.empty")}</EmptyHint>
      ) : (
        <Card size="sm">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center gap-1 px-3 py-2 text-sm text-muted-foreground">
              <Button variant="ghost" size="icon-xs" aria-label={t("files.up")} disabled={!canGoUp} onClick={goUp}>
                <CornerLeftUpIcon />
              </Button>
              {fsKind === "remote" ? (
                <>
                  <Button variant="ghost" size="xs" onClick={() => setRemotePath("")}>
                    <HardDriveIcon data-icon="inline-start" />
                    {t("files.root")}
                  </Button>
                  {crumbs.map((crumb, index) => (
                    <span key={`${crumb}-${index}`} className="flex items-center gap-1">
                      <ChevronRightIcon className="size-3.5" />
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          setRemotePath(crumbs.slice(0, index + 1).join("/"))
                        }
                      >
                        {crumb}
                      </Button>
                    </span>
                  ))}
                </>
              ) : (
                localCrumbs.map((crumb, index) => (
                  <span key={crumb.path} className="flex items-center gap-1">
                    {index > 0 ? <ChevronRightIcon className="size-3.5" /> : null}
                    <Button
                      variant="ghost"
                      size="xs"
                      className={index === localCrumbs.length - 1 ? "font-medium text-foreground" : undefined}
                      onClick={() => setLocalPath(crumb.path)}
                    >
                      {crumb.name}
                    </Button>
                  </span>
                ))
              )}
              <div className="relative ml-auto">
                <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 w-44 pl-7 text-xs sm:w-56"
                  placeholder={t("files.filterPlaceholder")}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  aria-label={t("files.filterPlaceholder")}
                />
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y text-left text-xs text-muted-foreground">
                  {sortColumns.map((column) => {
                    const active = column.sortKey === sortKey
                    return (
                      <th
                        key={column.sortKey}
                        className={cn("px-3 py-2 font-medium", column.className)}
                        aria-sort={
                          active ? (sortDir === "asc" ? "ascending" : "descending") : undefined
                        }
                      >
                        <button
                          type="button"
                          className={cn(
                            "flex items-center gap-1 hover:text-foreground",
                            active && "text-foreground"
                          )}
                          onClick={() => toggleSort(column.sortKey)}
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
                  <th className="px-3 py-2 font-medium">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => {
                  const name = item.name ?? item.path ?? ""
                  return (
                    <tr
                      key={name}
                      className="border-b last:border-b-0 hover:bg-muted/50"
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {item.is_dir ? (
                            <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                          )}
                          {item.is_dir ? (
                            <Button
                              variant="link"
                              size="xs"
                              className="px-0"
                              onClick={() => enterDir(name)}
                            >
                              {name}
                            </Button>
                          ) : (
                            <span className="font-mono text-xs">{name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {item.is_dir ? "—" : formatBytes(item.size)}
                      </td>
                      <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">
                        {item.mod_time
                          ? new Date(item.mod_time).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          {!item.is_dir ? (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={t("files.downloadFile")}
                              onClick={() => void downloadItem(item)}
                            >
                              <DownloadIcon />
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t("files.rename")}
                            onClick={() =>
                              setRename({ item, name })
                            }
                          >
                            <PenLineIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t("common.copy")}
                            onClick={() =>
                              setTransfer({
                                kind: "copy",
                                item,
                                target: fsKind === "remote" ? remoteName : "",
                              })
                            }
                          >
                            <CopyIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t("common.move")}
                            onClick={() =>
                              setTransfer({
                                kind: "move",
                                item,
                                target: fsKind === "remote" ? "" : remotePath,
                              })
                            }
                          >
                            <MoveIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t("common.delete")}
                            onClick={() => void deleteItem(item)}
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
          </CardContent>
        </Card>
      )}

      <Dialog open={mkdirOpen} onOpenChange={setMkdirOpen}>
        <DialogContent>
          <DialogHeader>{t("files.newDir")}</DialogHeader>
          <Input
            value={mkdirName}
            placeholder={t("files.mkdirPlaceholder")}
            onChange={(e) => setMkdirName(e.target.value)}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("common.cancel")}
            </DialogClose>
            <Button onClick={() => void mkdir()}>{t("common.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={transfer !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTransfer(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            {transfer?.kind === "copy" ? t("common.copy") : t("common.move")}{" "}
            {transfer?.item.name}
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label>{t("files.target")}</Label>
            <Input
              value={transfer?.target ?? ""}
              placeholder={t("files.targetPlaceholder")}
              onChange={(e) =>
                setTransfer((current) =>
                  current ? { ...current, target: e.target.value } : current
                )
              }
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {t("files.targetHelp")}
              {transfer?.kind === "move" ? ` ${t("files.moveWarning")}` : ""}
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("common.cancel")}
            </DialogClose>
            <Button onClick={() => void submitTransfer()}>
              {transfer?.kind === "copy" ? t("common.copy") : t("common.move")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rename !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRename(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            {t("files.rename")} {rename?.item.name}
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label>{t("files.renameTarget")}</Label>
            <Input
              value={rename?.name ?? ""}
              onChange={(e) =>
                setRename((current) =>
                  current ? { ...current, name: e.target.value } : current
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void submitRename()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t("common.cancel")}
            </DialogClose>
            <Button onClick={() => void submitRename()}>{t("files.rename")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
