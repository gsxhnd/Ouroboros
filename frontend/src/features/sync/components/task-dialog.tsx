import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { WarningNote } from "@/components/common/notes"
import { SelectField } from "@/components/common/select-field"
import { SwitchField } from "@/components/common/switch-field"
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
import type { RemoteInfo, SyncTask } from "@/lib/types"
import { EndpointEditor } from "@/features/sync/components/endpoint-editor"
import { useSyncStore } from "@/features/sync/sync-store"
import {
  endpointValid,
  initialFormFor,
  schedulePayload,
  valueToEndpoint,
  type FormState,
  type Mode,
  type OneWayOperation,
  type ScheduleChoice,
} from "@/features/sync/task-form-model"

/**
 * 新建 / 编辑同步任务。源和目标是"本地目录或 remote 内路径"，
 * 双向同步固定使用 bisync，单向可选复制 / 移动 / 镜像同步。
 * 表单状态在 Dialog 内容挂载时按 task 初始化（key 保证每次打开都重置）。
 */
export function TaskDialog({
  open,
  onOpenChange,
  task,
  remotes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: SyncTask | null
  remotes: RemoteInfo[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(94vw,36rem)] flex-col gap-0 overflow-y-auto p-0 sm:max-w-none">
        <TaskForm
          key={`${open ? "open" : "closed"}-${task?.id ?? "new"}`}
          task={task}
          remotes={remotes}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function TaskForm({
  task,
  remotes,
  onClose,
}: {
  task: SyncTask | null
  remotes: RemoteInfo[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const createTask = useSyncStore((state) => state.createTask)
  const patchTask = useSyncStore((state) => state.patchTask)
  const [form, setForm] = useState<FormState>(() => initialFormFor(task))
  const [submitting, setSubmitting] = useState(false)

  const update = (patch: Partial<FormState>) =>
    setForm((current) => ({ ...current, ...patch }))

  const valid = useMemo(
    () =>
      form.name.trim() !== "" &&
      endpointValid(form.source) &&
      endpointValid(form.target) &&
      (form.schedule !== "cron" || form.cron.trim() !== ""),
    [form]
  )

  const submit = async () => {
    if (!valid || submitting) {
      return
    }
    setSubmitting(true)
    const operation: SyncTask["operation"] =
      form.mode === "two_way" ? "bisync" : form.operation
    const values = {
      name: form.name.trim(),
      source: valueToEndpoint(form.source),
      target: valueToEndpoint(form.target),
      operation,
      bw_limit: form.bwLimit.trim(),
      max_transfer: form.maxTransfer.trim(),
      schedule: schedulePayload(form.schedule, form.cron),
      enabled: form.enabled,
    }
    const result = task
      ? await patchTask(task.id, values)
      : await createTask(values)
    setSubmitting(false)
    if (result) {
      onClose()
    }
  }

  const operationOptions = [
    { value: "sync" as const, label: t("sync.opSync") },
    { value: "copy" as const, label: t("sync.opCopy") },
    { value: "move" as const, label: t("sync.opMove") },
  ]

  const scheduleOptions = [
    { value: "manual" as const, label: t("sync.scheduleManual") },
    { value: "hourly" as const, label: t("sync.scheduleHourly") },
    { value: "daily" as const, label: t("sync.scheduleDaily") },
    { value: "weekly" as const, label: t("sync.scheduleWeekly") },
    { value: "cron" as const, label: t("sync.scheduleCron") },
  ]

  return (
    <>
      <DialogHeader className="border-b px-4 py-3">
        <DialogTitle>
          {task ? t("sync.editTask") : t("sync.newTask")}
        </DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sync-task-name">{t("sync.taskName")}</Label>
          <Input
            id="sync-task-name"
            value={form.name}
            maxLength={100}
            placeholder={t("sync.taskNamePlaceholder")}
            onChange={(event) => update({ name: event.target.value })}
          />
        </div>

        <EndpointEditor
          label={t("sync.source")}
          value={form.source}
          remotes={remotes}
          onChange={(value) => update({ source: value })}
        />
        <EndpointEditor
          label={t("sync.target")}
          value={form.target}
          remotes={remotes}
          onChange={(value) => update({ target: value })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField<Mode>
            label={t("sync.mode")}
            value={form.mode}
            options={[
              { value: "one_way", label: t("sync.modeOneWay") },
              { value: "two_way", label: t("sync.modeTwoWay") },
            ]}
            onChange={(value) => update({ mode: value })}
          />
          {form.mode === "one_way" ? (
            <SelectField<OneWayOperation>
              label={t("sync.operation")}
              value={form.operation}
              options={operationOptions}
              onChange={(value) => update({ operation: value })}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>{t("sync.operation")}</Label>
              <p className="rounded-lg bg-muted px-2.5 py-1.5 text-sm text-muted-foreground">
                {t("sync.opBisync")}
              </p>
            </div>
          )}
        </div>

        {form.mode === "two_way" ? (
          <WarningNote>{t("sync.bisyncHint")}</WarningNote>
        ) : form.operation === "sync" ? (
          <WarningNote>{t("sync.opSyncHint")}</WarningNote>
        ) : form.operation === "move" ? (
          <WarningNote>{t("sync.opMoveHint")}</WarningNote>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sync-bw-limit">{t("sync.bwLimit")}</Label>
            <Input
              id="sync-bw-limit"
              value={form.bwLimit}
              placeholder={t("sync.bwLimitPlaceholder")}
              onChange={(event) => update({ bwLimit: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {t("sync.bwLimitHint")}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sync-max-transfer">{t("sync.maxTransfer")}</Label>
            <Input
              id="sync-max-transfer"
              value={form.maxTransfer}
              placeholder={t("sync.maxTransferPlaceholder")}
              onChange={(event) => update({ maxTransfer: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {t("sync.maxTransferHint")}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField<ScheduleChoice>
            label={t("sync.schedule")}
            value={form.schedule}
            options={scheduleOptions}
            onChange={(value) => update({ schedule: value })}
          />
          {form.schedule === "cron" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sync-cron">{t("sync.cronExpr")}</Label>
              <Input
                id="sync-cron"
                value={form.cron}
                placeholder="0 */6 * * *"
                onChange={(event) => update({ cron: event.target.value })}
              />
            </div>
          ) : null}
        </div>

        <SwitchField
          label={t("sync.enabled")}
          checked={form.enabled}
          onCheckedChange={(checked) => update({ enabled: checked })}
        />
      </div>
      <DialogFooter className="border-t px-4 py-3">
        <DialogClose render={<Button variant="outline" />}>
          {t("common.cancel")}
        </DialogClose>
        <Button disabled={!valid || submitting} onClick={() => void submit()}>
          {task ? t("common.save") : t("common.create")}
        </Button>
      </DialogFooter>
    </>
  )
}

/** 源 / 目标端点编辑器：本地绝对目录，或 remote + 可选子路径。 */
