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
} from "@/features/files/components/dialogs"
import { FileTable, type SortKey } from "@/features/files/components/file-table"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { ConfirmNameDialog } from "@/components/common/confirm-name-dialog"
import { SelectField } from "@/components/common/select-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { withAccessToken } from "@/lib/http/transport"
import { getAuthToken } from "@/lib/auth"
import { call, errorMessage } from "@/lib/http/client"
import { joinPath, parentPath, splitPath } from "@/lib/paths"
import {
  itemName,
  joinRemote,
  parseTransferTarget,
  remoteParent,
} from "@/features/files/file-paths"
import type { FilesResponse, ListItem, RemoteInfo } from "@/lib/types"
import { cn } from "cn"

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
  const [deleteTarget, setDeleteTarget] = useState<ListItem | null>(null)
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
    // 端点解析内联在回调里，依赖数组可被静态核对（fsKind / remoteName /
    // remotePath / localPath 全部直接引用）。
    const fs = fsKind === "remote" ? remoteName : localPath.trim()
    const remote = fsKind === "remote" ? remotePath : ""
    if (!fs) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const query = new URLSearchParams({ fs, remote })
      const data = await call<FilesResponse>(`/api/files?${query}`)
      setItems(data.items)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
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
      setRemotePath(joinRemote(remotePath, name))
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
      const name = itemName(item).toLowerCase()
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

  // 删除是危险操作：先弹 ConfirmNameDialog 展示名称与影响（目录会连同
  // 内容一并 purge），确认后才发请求，与任务 / 存储的删除确认同一套路。
  const deleteWarning =
    deleteTarget === null
      ? ""
      : deleteTarget.is_dir
        ? t("files.deleteDirConfirm", {
            name: deleteTarget.name ?? deleteTarget.path ?? "",
          })
        : t("files.deleteFileConfirm", {
            name: deleteTarget.name ?? deleteTarget.path ?? "",
          })

  const runDelete = async () => {
    const item = deleteTarget
    setDeleteTarget(null)
    if (!item) {
      return
    }
    const name = itemName(item)
    const params = new URLSearchParams({
      fs: currentFs(),
      remote: joinRemote(currentRemote(), name),
    })
    if (item.is_dir) {
      params.set("purge", "true")
    }
    try {
      await call(`/api/files?${params}`, { method: "DELETE" })
      toast.success(t("files.deleted", { name }))
      await list()
    } catch {
      // call() has already shown the error toast.
    }
  }

  const mkdir = async (name: string) => {
    await call("/api/files/mkdir", {
      method: "POST",
      body: {
        fs: currentFs(),
        remote: joinRemote(currentRemote(), name),
      },
    })
    toast.success(t("files.created", { name }))
    await list()
  }

  const submitTransfer = async () => {
    if (!transfer) {
      return
    }
    const name = itemName(transfer.item)
    const target = transfer.target.trim()
    if (!target) {
      toast.error(t("files.targetRequired"))
      return
    }
    const destination = parseTransferTarget(target, {
      name,
      isDir: Boolean(transfer.item.is_dir),
    })
    await call(`/api/files/${transfer.kind}`, {
      method: "POST",
      body: {
        src_fs: currentFs(),
        src_remote: joinRemote(currentRemote(), name) || undefined,
        dst_fs: destination.fs,
        dst_remote: destination.remote,
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
    const name = itemName(rename.item)
    const target = rename.name.trim()
    if (!target || target.includes("/")) {
      toast.error(t("files.renameInvalid"))
      return
    }
    await call("/api/files/move", {
      method: "POST",
      body: {
        src_fs: currentFs(),
        src_remote: joinRemote(currentRemote(), name),
        dst_fs: currentFs(),
        dst_remote: joinRemote(currentRemote(), target),
        directory: Boolean(rename.item.is_dir),
      },
    })
    toast.success(t("files.renameDone", { name, target }))
    setRename(null)
    await list()
  }

  /** 下载单个文件：先探测接口，失败时提示后端给出的原因。 */
  const downloadItem = async (item: ListItem) => {
    const name = itemName(item)
    const params = new URLSearchParams({
      fs: currentFs(),
      remote: joinRemote(currentRemote(), name),
    })
    const url = `/api/files/download?${params}`
    const token = getAuthToken()
    try {
      const response = await fetch(url, {
        credentials: "same-origin",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
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
      link.href = withAccessToken(url)
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
      <PageHeader title={t("nav.files")} description={t("nav.filesHint")} />

      <Card className="py-0">
        <CardContent className="flex flex-col gap-3 p-4">
          <p className="text-xs text-muted-foreground">
            {t("files.locationDescription")}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <SelectField
              label={t("files.source")}
              className="w-full sm:w-52"
              value={fsKind}
              options={[
                { value: "remote", label: t("files.sourceRemote") },
                { value: "local", label: t("files.sourceLocal") },
              ]}
              onChange={setFsKind}
            />
            {fsKind === "remote" ? (
              <SelectField
                label={t("files.remoteLabel")}
                className="w-full sm:w-56"
                value={remoteName}
                options={remotes.map((r) => ({ value: r.name, label: r.name }))}
                onChange={(next) => {
                  setRemoteName(next)
                  setRemotePath("")
                }}
                disabled={remotes.length === 0}
                placeholder={
                  remotes.length === 0 ? t("files.noRemotes") : undefined
                }
              />
            ) : (
              <div className="flex w-full flex-col gap-1.5 sm:w-72">
                <Label>{t("files.localDir")}</Label>
                <Input
                  className="font-mono"
                  placeholder="/absolute/path"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void list()}>
                <RefreshCcwIcon data-icon="inline-start" />
                {t("common.refresh")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMkdirOpen(true)}
              >
                <FolderPlusIcon data-icon="inline-start" />
                {t("files.newDir")}
              </Button>
            </div>
          </div>
        </CardContent>
        <Separator />
        <div className="flex min-w-0 items-center gap-2 px-3 py-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("files.up")}
            disabled={!canGoUp}
            onClick={goUp}
          >
            <CornerLeftUpIcon />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm text-muted-foreground">
            {fsKind === "remote" ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    crumbs.length === 0 && "font-medium text-foreground"
                  )}
                  onClick={() => setRemotePath("")}
                >
                  <HardDriveIcon data-icon="inline-start" />
                  {t("files.root")}
                </Button>
                {crumbs.map((crumb, index) => (
                  <span
                    key={crumbs.slice(0, index + 1).join("/")}
                    className="flex shrink-0 items-center gap-1"
                  >
                    <ChevronRightIcon className="size-3.5 shrink-0" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        index === crumbs.length - 1 &&
                          "font-medium text-foreground"
                      )}
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
                <span
                  key={crumb.path}
                  className="flex shrink-0 items-center gap-1"
                >
                  {index > 0 ? (
                    <ChevronRightIcon className="size-3.5 shrink-0" />
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
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
          </div>
          <InputGroup className="w-40 shrink-0 sm:w-56">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t("files.filterPlaceholder")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label={t("files.filterPlaceholder")}
            />
          </InputGroup>
        </div>
        <Separator />
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground">
            <Spinner />
            {t("files.loading")}
          </div>
        ) : visibleItems.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-pretty text-muted-foreground">
            {items.length === 0 ? t("files.empty") : t("files.noMatches")}
          </p>
        ) : (
          <FileTable
            items={visibleItems}
            sortKey={sortKey}
            sortDir={sortDir}
            onToggleSort={toggleSort}
            onEnterDir={enterDir}
            onDownload={(item) => void downloadItem(item)}
            onRename={(item) => setRename({ item, name: itemName(item) })}
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
            onDelete={(item) => setDeleteTarget(item)}
          />
        )}
      </Card>

      <MkdirDialog
        open={mkdirOpen}
        onOpenChange={setMkdirOpen}
        onCreate={mkdir}
      />

      <TransferDialog
        state={transfer}
        onTargetChange={(target) =>
          setTransfer((current) => (current ? { ...current, target } : current))
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

      <ConfirmNameDialog
        open={deleteTarget !== null}
        title={t("common.delete")}
        warning={deleteWarning}
        expectedName={null}
        confirmLabel={t("common.delete")}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        onConfirm={() => void runDelete()}
      />
    </PageContainer>
  )
}
