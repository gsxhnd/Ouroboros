import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ListItem } from "@/lib/types"

/** 新建文件夹对话框：自行持有输入并做名称校验，onCreate 返回后关闭。 */
export function MkdirDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string) => Promise<void>
}) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>{t("files.newDir")}</DialogHeader>
        <MkdirForm onCreate={onCreate} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

/** 表单放在 Dialog 内容里：关闭即卸载、打开即重置，无需 effect。 */
function MkdirForm({
  onCreate,
  onDone,
}: {
  onCreate: (name: string) => Promise<void>
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState("")

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed.includes("/")) {
      toast.error(t("files.nameInvalid"))
      return
    }
    await onCreate(trimmed)
    onDone()
  }

  return (
    <>
      <Input
        value={name}
        placeholder={t("files.mkdirPlaceholder")}
        onChange={(event) => setName(event.target.value)}
      />
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>
          {t("common.cancel")}
        </DialogClose>
        <Button onClick={() => void submit()}>{t("common.create")}</Button>
      </DialogFooter>
    </>
  )
}

export type TransferState = {
  kind: "copy" | "move"
  item: ListItem
  target: string
}

/** 复制 / 移动目标输入：目标由页面预填，提交后由页面执行并刷新列表。 */
export function TransferDialog({
  state,
  onTargetChange,
  onClose,
  onSubmit,
}: {
  state: TransferState | null
  onTargetChange: (target: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          {state?.kind === "copy" ? t("common.copy") : t("common.move")}{" "}
          {state?.item.name}
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label>{t("files.target")}</Label>
          <Input
            value={state?.target ?? ""}
            placeholder={t("files.targetPlaceholder")}
            onChange={(event) => onTargetChange(event.target.value)}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            {t("files.targetHelp")}
            {state?.kind === "move" ? ` ${t("files.moveWarning")}` : ""}
          </p>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button onClick={onSubmit}>
            {state?.kind === "copy" ? t("common.copy") : t("common.move")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type RenameState = {
  item: ListItem
  name: string
}

/** 重命名对话框：回车提交，由页面执行移动语义的重命名。 */
export function RenameDialog({
  state,
  onNameChange,
  onClose,
  onSubmit,
}: {
  state: RenameState | null
  onNameChange: (name: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          {t("files.rename")} {state?.item.name}
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label>{t("files.renameTarget")}</Label>
          <Input
            value={state?.name ?? ""}
            onChange={(event) => onNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSubmit()
              }
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button onClick={onSubmit}>{t("files.rename")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
