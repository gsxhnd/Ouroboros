import { useCallback, useEffect, useState } from "react"
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
        item.is_dir ? `删除目录 "${name}" 及其全部内容？` : `删除文件 "${name}"？`
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
      toast.success(`已删除 ${name}`)
      await list()
    } catch {
      toast.error(errorMessage(null))
    }
  }

  const mkdir = async () => {
    const name = mkdirName.trim()
    if (!name || name.includes("/")) {
      toast.error("目录名不能包含 /")
      return
    }
    await call("/api/files/mkdir", {
      method: "POST",
      body: {
        fs: currentFs(),
        remote: join(currentRemote(), name),
      },
    })
    toast.success(`已创建 ${name}`)
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
      toast.error("请输入目标位置")
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
      `${transfer.kind === "copy" ? "复制" : "移动"}已提交：${name} → ${target}`
    )
    setTransfer(null)
    await list()
  }

  const crumbs = remotePath ? remotePath.split("/") : []

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>浏览位置</CardTitle>
          <CardDescription>需要 rclone 运行中才能列出文件。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <SelectField
            label="来源"
            className="w-56"
            value={fsKind}
            options={[
              { value: "remote", label: "远程 remote" },
              { value: "local", label: "本地路径" },
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
              placeholder={remotes.length === 0 ? "没有 remote" : undefined}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>本地目录</Label>
              <Input
                className="w-72 font-mono"
                placeholder="/absolute/path"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
              />
            </div>
          )}
          <Button size="sm" variant="outline" onClick={() => void list()}>
            <RefreshCcwIcon /> 刷新
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMkdirOpen(true)}>
            <FolderPlusIcon /> 新建目录
          </Button>
        </CardContent>
      </Card>

      {items.length === 0 && !loading ? (
        <EmptyHint>此目录为空，或 rclone 还没有运行。</EmptyHint>
      ) : (
        <Card size="sm">
          <CardContent className="p-0">
            {fsKind === "remote" ? (
              <div className="flex flex-wrap items-center gap-1 px-3 py-2 text-sm text-muted-foreground">
                <Button variant="ghost" size="xs" onClick={() => setRemotePath("")}>
                  <HardDriveIcon data-icon="inline-start" />
                  根目录
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
                  <th className="px-3 py-2 font-medium">名称</th>
                  <th className="px-3 py-2 font-medium">大小</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">
                    修改时间
                  </th>
                  <th className="px-3 py-2 font-medium">操作</th>
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
                            aria-label="复制"
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
                            aria-label="移动"
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
                            aria-label="删除"
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
          <DialogHeader>新建目录</DialogHeader>
          <Input
            value={mkdirName}
            placeholder="目录名"
            onChange={(e) => setMkdirName(e.target.value)}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
            <Button onClick={() => void mkdir()}>创建</Button>
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
            {transfer?.kind === "copy" ? "复制" : "移动"} {transfer?.item.name}
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label>目标</Label>
            <Input
              value={transfer?.target ?? ""}
              placeholder="remote 名（或 remote/sub/dir）或本地绝对路径"
              onChange={(e) =>
                setTransfer((current) =>
                  current ? { ...current, target: e.target.value } : current
                )
              }
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              输入另一个 remote 名，或以 / 开头的本地绝对路径。
              {transfer?.kind === "move" ? "移动会把源文件删除。" : ""}
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
            <Button onClick={() => void submitTransfer()}>
              {transfer?.kind === "copy" ? "复制" : "移动"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
