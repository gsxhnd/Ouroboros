import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ChevronRightIcon,
  CopyIcon,
  FolderPlusIcon,
  HardDriveIcon,
  MoveIcon,
  RefreshCcwIcon,
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
import type { FilesResponse, ListItem, RemoteInfo } from "@/lib/types"
import { toast } from "sonner"

type TransferKind = "copy" | "move"

type TransferState = {
  kind: TransferKind
  item: ListItem
  target: string
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
  const [mkdirName, setMkdirName] = useState("")
  const [transfer, setTransfer] = useState<TransferState | null>(null)

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

  const crumbs = remotePath ? remotePath.split("/") : []

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
            {fsKind === "remote" ? (
              <div className="flex flex-wrap items-center gap-1 px-3 py-2 text-sm text-muted-foreground">
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
              </div>
            ) : null}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t("common.name")}</th>
                  <th className="px-3 py-2 font-medium">{t("files.columnSize")}</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">
                    {t("files.columnModified")}
                  </th>
                  <th className="px-3 py-2 font-medium">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const name = item.name ?? item.path ?? ""
                  return (
                    <tr
                      key={name}
                      className="border-b last:border-b-0 hover:bg-muted/50"
                    >
                      <td className="px-3 py-2">
                        {item.is_dir ? (
                          <Button
                            variant="link"
                            size="xs"
                            className="px-0"
                            onClick={() => setRemotePath(join(remotePath, name))}
                          >
                            {name}
                          </Button>
                        ) : (
                          <span className="font-mono text-xs">{name}</span>
                        )}
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
    </>
  )
}
