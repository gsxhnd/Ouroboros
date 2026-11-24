import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ChevronRightIcon,
  CornerLeftUpIcon,
  FolderPlusIcon,
  HardDriveIcon,
  RefreshCcwIcon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  MkdirDialog,
  RenameDialog,
  TransferDialog,
  type RenameState,
  type TransferState,
} from "@/components/files/dialogs"
import { FileTable, type SortKey } from "@/components/files/file-table"
import { PageContainer, PageHeader } from "@/components/page-header"
import { EmptyHint, SelectField } from "@/components/shared"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { call, errorMessage } from "@/lib/client"
import { joinPath, parentPath, splitPath } from "@/lib/paths"
import type { FilesResponse, ListItem, RemoteInfo } from "@/lib/types"
import { cn } from "cn"

/** 远程路径的上一级；根目录时返回空串。 */
function remoteParent(path: string): string {
  const index = path.lastIndexOf("/")
  return index < 0 ? "" : path.slice(0, index)
}

const join = (base: string, name: string | null) =>
  base ? `${base}/${name}` : (name ?? "")

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
    fsKind === "remote"
      ? remotePath !== ""
      : parentPath(localPath) !== localPath

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

  const mkdir = async (name: string) => {
    await call("/api/files/mkdir", {
      method: "POST",
      body: {
        fs: currentFs(),
        remote: join(currentRemote(), name),
      },
    })
    toast.success(t("files.created", { name }))
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
  const localCrumbs =
    fsKind === "local" && localPath.trim() ? splitPath(localPath) : []

  return (
    <PageContainer>
      <PageHeader
        title={t("nav.files")}
        description={t("nav.filesHint")}
      />

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
        <Card size="sm" className="py-0">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center gap-1 px-3 py-2 text-sm text-muted-foreground">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("files.up")}
                disabled={!canGoUp}
                onClick={goUp}
              >
                <CornerLeftUpIcon />
              </Button>
              {fsKind === "remote" ? (
                <>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setRemotePath("")}
                  >
                    <HardDriveIcon data-icon="inline-start" />
                    {t("files.root")}
                  </Button>
                  {crumbs.map((crumb, index) => (
                    <span
                      key={`${crumb}-${index}`}
                      className="flex items-center gap-1"
                    >
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
                      className={cn(
                        index === localCrumbs.length - 1 &&
                          "font-medium text-foreground"
                      )}
                      onClick={() => setLocalPath(crumb.path)}
                    >
                      {crumb.name}
                    </Button>
                  </span>
                ))
              )}
              <div className="relative ms-auto">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 w-44 pl-7 text-xs sm:w-56"
                  placeholder={t("files.filterPlaceholder")}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  aria-label={t("files.filterPlaceholder")}
                />
              </div>
            </div>
            <FileTable
              items={visibleItems}
              sortKey={sortKey}
              sortDir={sortDir}
              onToggleSort={toggleSort}
              onEnterDir={enterDir}
              onDownload={(item) => void downloadItem(item)}
              onRename={(item) =>
                setRename({ item, name: item.name ?? item.path ?? "" })
              }
              onCopy={(item) =>
                setTransfer({
                  kind: "copy",
                  item,
                  target: fsKind === "remote" ? remoteName : "",
                })
              }
              onMove={(item) =>
                setTransfer({
                  kind: "move",
                  item,
                  target: fsKind === "remote" ? "" : remotePath,
                })
              }
              onDelete={(item) => void deleteItem(item)}
            />
          </CardContent>
        </Card>
      )}

      <MkdirDialog
        open={mkdirOpen}
        onOpenChange={setMkdirOpen}
        onCreate={mkdir}
      />

      <TransferDialog
        state={transfer}
        onTargetChange={(target) =>
          setTransfer((current) =>
            current ? { ...current, target } : current
          )
        }
        onClose={() => setTransfer(null)}
        onSubmit={() => void submitTransfer()}
      />

      <RenameDialog
        state={rename}
        onNameChange={(name) =>
          setRename((current) => (current ? { ...current, name } : current))
        }
        onClose={() => setRename(null)}
        onSubmit={() => void submitRename()}
      />
    </PageContainer>
  )
}
