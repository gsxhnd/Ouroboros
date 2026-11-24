import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { SelectField, SwitchField } from "@/components/shared"
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
import type { RemoteInfo, SyncTask, TaskEndpoint } from "@/lib/types"
import {
  scheduleFor,
  useSyncStore,
  type SchedulePreset,
} from "@/stores/sync-store"

type Mode = "one_way" | "two_way"
type OneWayOperation = "copy" | "move" | "sync"
type ScheduleChoice = SchedulePreset | "cron"

type EndpointValue = {
  kind: "local" | "remote"
  path: string
  remote: string
}

type FormState = {
  name: string
  source: EndpointValue
  target: EndpointValue
  mode: Mode
  operation: OneWayOperation
  bwLimit: string
  maxTransfer: string
  schedule: ScheduleChoice
  cron: string
  enabled: boolean
}

const emptyEndpoint: EndpointValue = {
  kind: "local",
  path: "",
  remote: "",
}

function initialFormFor(task: SyncTask | null): FormState {
  if (!task) {
    return {
      name: "",
      source: { ...emptyEndpoint },
      target: { ...emptyEndpoint },
      mode: "one_way",
      operation: "sync",
      bwLimit: "",
      maxTransfer: "",
      schedule: "manual",
      cron: "",
      enabled: true,
    }
  }
  const schedule = task.schedule
  const choice: ScheduleChoice = !schedule?.enabled
    ? "manual"
    : schedule.mode === "cron"
      ? "cron"
      : ((schedule.preset as SchedulePreset) ?? "daily")
  return {
    name: task.name,
    source: endpointToValue(task.source),
    target: endpointToValue(task.target),
    mode: task.operation === "bisync" ? "two_way" : "one_way",
    operation: (task.operation === "bisync"
      ? "sync"
      : task.operation) as OneWayOperation,
    bwLimit: task.bw_limit ?? "",
    maxTransfer: task.max_transfer ?? "",
    schedule: choice,
    cron: schedule?.cron ?? "",
    enabled: task.enabled,
  }
}

function endpointToValue(endpoint: TaskEndpoint | undefined): EndpointValue {
  if (!endpoint) {
    return { ...emptyEndpoint }
  }
  return {
    kind: endpoint.kind,
    path: endpoint.path ?? "",
    remote: endpoint.remote ?? "",
  }
}

function valueToEndpoint(value: EndpointValue): TaskEndpoint {
  return value.kind === "remote"
    ? { kind: "remote", remote: value.remote, path: value.path }
    : { kind: "local", path: value.path }
}

function schedulePayload(
  choice: ScheduleChoice,
  cron: string
): {
  mode: string
  preset?: string
  cron?: string
  timezone: string
  enabled: boolean
} {
  if (choice === "cron") {
    const payload = scheduleFor("manual")
    return { ...payload, mode: "cron", cron: cron.trim(), enabled: true }
  }
  return scheduleFor(choice)
}

function endpointValid(value: EndpointValue): boolean {
  if (value.kind === "local") {
    return value.path.trim().startsWith("/")
  }
  return value.remote.trim() !== "" && !value.path.trim().startsWith("/")
}

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
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            {t("sync.bisyncHint")}
          </p>
        ) : form.operation === "sync" ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            {t("sync.opSyncHint")}
          </p>
        ) : form.operation === "move" ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            {t("sync.opMoveHint")}
          </p>
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
function EndpointEditor({
  label,
  value,
  remotes,
  onChange,
}: {
  label: string
  value: EndpointValue
  remotes: RemoteInfo[]
  onChange: (value: EndpointValue) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl border p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-2">
        <SelectField<"local" | "remote">
          value={value.kind}
          options={[
            { value: "local", label: t("sync.endpointLocal") },
            { value: "remote", label: t("sync.endpointRemote") },
          ]}
          onChange={(kind) => onChange({ ...value, kind })}
        />
        {value.kind === "local" ? (
          <Input
            value={value.path}
            placeholder={t("sync.localPathPlaceholder")}
            onChange={(event) =>
              onChange({ ...value, path: event.target.value })
            }
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <SelectField
              value={value.remote}
              placeholder={t("sync.remoteSelect")}
              options={remotes.map((item) => ({
                value: item.name,
                label: item.name,
              }))}
              onChange={(remote) => onChange({ ...value, remote })}
            />
            <Input
              value={value.path}
              placeholder={t("sync.remotePathPlaceholder")}
              onChange={(event) =>
                onChange({ ...value, path: event.target.value })
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
