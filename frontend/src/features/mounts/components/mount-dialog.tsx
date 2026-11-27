import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { WarningNote } from "@/components/common/notes"
import { SelectField } from "@/components/common/select-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useMountStore } from "@/features/mounts/mount-store"
import { isLocalPath } from "@/lib/paths"
import type { RemoteInfo } from "@/lib/types"

/**
 * 新建挂载。源固定是 remote（可带子路径），目标固定是本地目录。
 * rclone 未运行时没有 remote 列表，这时允许直接填写 remote 名称。
 */
export function MountDialog({
  open,
  onOpenChange,
  remotes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  remotes: RemoteInfo[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(94vw,36rem)] flex-col gap-0 overflow-y-auto p-0 sm:max-w-none">
        <MountForm
          key={open ? "open" : "closed"}
          remotes={remotes}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function MountForm({
  remotes,
  onClose,
}: {
  remotes: RemoteInfo[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const createMount = useMountStore((state) => state.createMount)
  const [name, setName] = useState("")
  const [remote, setRemote] = useState(remotes[0]?.name ?? "")
  const [remotePath, setRemotePath] = useState("")
  const [localPath, setLocalPath] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const valid = useMemo(
    () =>
      name.trim() !== "" &&
      remote.trim() !== "" &&
      !isLocalPath(remotePath) &&
      isLocalPath(localPath),
    [name, remote, remotePath, localPath]
  )

  const submit = async () => {
    if (!valid || submitting) {
      return
    }
    setSubmitting(true)
    const result = await createMount({
      name: name.trim(),
      source: {
        kind: "remote",
        remote: remote.trim(),
        path: remotePath.trim(),
      },
      target: { kind: "local", path: localPath.trim() },
    })
    setSubmitting(false)
    if (result) {
      toast.success(t("mounts.created", { name: result.name }))
      onClose()
    }
  }

  return (
    <>
      <DialogHeader className="border-b px-4 py-3">
        <DialogTitle>{t("mounts.createTitle")}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mount-name">{t("mounts.name")}</Label>
          <Input
            id="mount-name"
            value={name}
            maxLength={100}
            placeholder={t("mounts.namePlaceholder")}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2 rounded-xl border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t("mounts.source")}
          </p>
          {remotes.length > 0 ? (
            <SelectField
              value={remote}
              placeholder={t("sync.remoteSelect")}
              options={remotes.map((item) => ({
                value: item.name,
                label: item.name,
              }))}
              onChange={setRemote}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mount-remote">{t("mounts.remoteName")}</Label>
              <Input
                id="mount-remote"
                value={remote}
                placeholder={t("mounts.remoteNamePlaceholder")}
                onChange={(event) => setRemote(event.target.value)}
              />
            </div>
          )}
          <Input
            value={remotePath}
            placeholder={t("sync.remotePathPlaceholder")}
            onChange={(event) => setRemotePath(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2 rounded-xl border p-3">
          <Label htmlFor="mount-target">{t("mounts.target")}</Label>
          <Input
            id="mount-target"
            className="font-mono"
            value={localPath}
            placeholder={t("sync.localPathPlaceholder")}
            onChange={(event) => setLocalPath(event.target.value)}
          />
        </div>

        <WarningNote>{t("mounts.impact")}</WarningNote>
      </div>
      <DialogFooter className="mx-0 mb-0 rounded-none px-4 py-3">
        <DialogClose render={<Button variant="outline" />}>
          {t("common.cancel")}
        </DialogClose>
        <Button disabled={!valid || submitting} onClick={() => void submit()}>
          {t("common.create")}
        </Button>
      </DialogFooter>
    </>
  )
}
