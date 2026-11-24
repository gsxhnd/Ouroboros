import { useState, type ReactNode } from "react"
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

/**
 * 名称确认对话框：危险删除（同步任务、remote 等）统一要求输入名称才能确认；
 * expectedName 为空时退化为普通确认。
 * 输入状态放在 Dialog 内容组件里，关闭即卸载、打开即重置，无需 effect。
 */
export function ConfirmNameDialog({
  open,
  title,
  warning,
  expectedName,
  confirmLabel,
  onOpenChange,
  onConfirm,
  children,
}: {
  open: boolean
  title: string
  warning: ReactNode
  /** 需要输入的名称；null 表示只展示警告即可确认。 */
  expectedName: string | null
  confirmLabel: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  /** 警告区之后的附加内容（如影响说明）。 */
  children?: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,28rem)] sm:max-w-none">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ConfirmNameBody
          warning={warning}
          expectedName={expectedName}
          confirmLabel={confirmLabel}
          onConfirm={onConfirm}
        >
          {children}
        </ConfirmNameBody>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmNameBody({
  warning,
  expectedName,
  confirmLabel,
  onConfirm,
  children,
}: {
  warning: ReactNode
  expectedName: string | null
  confirmLabel: string
  onConfirm: () => void
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const matched = expectedName !== null && name.trim() === expectedName

  return (
    <>
      <div className="flex flex-col gap-2 text-sm">
        <div className="leading-relaxed text-muted-foreground">{warning}</div>
        {children}
        {expectedName !== null ? (
          <Input
            value={name}
            placeholder={expectedName}
            aria-label={t("common.confirmName")}
            onChange={(event) => setName(event.target.value)}
          />
        ) : null}
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>
          {t("common.cancel")}
        </DialogClose>
        <Button
          variant="destructive"
          disabled={expectedName !== null && !matched}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  )
}
