import type { JobLocator, SyncTask, TaskEndpoint } from "@/lib/types"

/** 同步任务端点的可读显示：remote 形如 name:path，本地为绝对路径。 */
export function endpointLabel(endpoint: TaskEndpoint): string {
  return endpoint.kind === "remote"
    ? `${endpoint.remote}:${endpoint.path ?? ""}`
    : (endpoint.path ?? "")
}

/** 单向同步的操作徽标文案。 */
export function operationLabel(
  task: Pick<SyncTask, "operation"> | { operation: string },
  t: (key: string) => string
): string {
  switch (task.operation) {
    case "bisync":
      return t("sync.opBisync")
    case "copy":
      return t("sync.opCopy")
    case "move":
      return t("sync.opMove")
    default:
      return t("sync.opSync")
  }
}

/** 计划徽标文案：手动 / 预设 / cron。 */
export function scheduleLabel(
  task: Pick<SyncTask, "schedule">,
  t: (key: string) => string
): string {
  const schedule = task.schedule
  if (!schedule?.enabled) {
    return t("sync.scheduleManual")
  }
  if (schedule.mode === "cron") {
    return `${t("sync.scheduleCron")} · ${schedule.cron ?? ""}`
  }
  switch (schedule.preset) {
    case "hourly":
      return t("sync.scheduleHourly")
    case "weekly":
      return t("sync.scheduleWeekly")
    default:
      return t("sync.scheduleDaily")
  }
}

/** 双向同步是否需要先执行 resync 初始化。 */
export function bisyncNeedsResync(
  task: Pick<SyncTask, "operation" | "last_result">
): boolean {
  return task.operation === "bisync" && task.last_result?.status !== "succeeded"
}

/** 执行记录的触发来源文案：手动 / 计划。 */
export function triggerLabel(
  trigger: string | null | undefined,
  t: (key: string) => string
): string {
  return trigger === "scheduled"
    ? t("sync.triggerScheduled")
    : t("sync.triggerManual")
}

/** 任务快照端点的可读显示，与后端 Locator.Display() 一致。 */
export function locatorLabel(locator: JobLocator): string {
  if (locator.kind === "remote") {
    return `${locator.fs.replace(/:$/, "")}:${locator.remote}`
  }
  return locator.remote ? `${locator.fs}/${locator.remote}` : locator.fs
}
