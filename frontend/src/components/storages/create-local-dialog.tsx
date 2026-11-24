import { useState } from "react"
import { useTranslation } from "react-i18next"

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

/** 新建本地存储：名称 + 绝对路径，同步任务按路径自动复用。 */
export function CreateLocalDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (input: { label: string; local_path: string }) => Promise<void>
}) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,26rem)] sm:max-w-none">
        <DialogHeader>
          <DialogTitle>{t("storage.newLocal")}</DialogTitle>
        </DialogHeader>
        <CreateLocalForm onCreate={onCreate} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

/** 表单放在 Dialog 内容里：关闭即卸载、打开即重置，无需 effect。 */
function CreateLocalForm({
  onCreate,
  onDone,
}: {
  onCreate: (input: { label: string; local_path: string }) => Promise<void>
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [label, setLabel] = useState("")
  const [path, setPath] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const valid = label.trim() !== "" && path.trim().startsWith("/")

  const submit = async () => {
    if (!valid || submitting) {
      return
    }
    setSubmitting(true)
    await onCreate({ label: label.trim(), local_path: path.trim() })
    setSubmitting(false)
    onDone()
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="storage-local-name">{t("storage.localName")}</Label>
          <Input
            id="storage-local-name"
            value={label}
            maxLength={100}
            placeholder={t("storage.localNamePlaceholder")}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="storage-local-path">{t("storage.localPath")}</Label>
          <Input
            id="storage-local-path"
            value={path}
            placeholder={t("storage.localPathPlaceholder")}
            className="font-mono"
            onChange={(event) => setPath(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t("storage.localPathHint")}
          </p>
        </div>
      </div>
      <DialogFooter>
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
