import { isLocalPath } from "@/lib/paths"
import type { SyncTask, TaskEndpoint } from "@/lib/types"

export type SchedulePreset = "manual" | "hourly" | "daily" | "weekly"

/** 用户本地时区；后端 schedule 支持任意 IANA 时区，不必硬编码 UTC。 */
const LOCAL_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

/** 把面板上的计划预设转成后端 schedule 结构。 */
export function scheduleFor(preset: SchedulePreset) {
  return {
    mode: "preset",
    preset: preset === "manual" ? "daily" : preset,
    timezone: LOCAL_TIMEZONE,
    enabled: preset !== "manual",
  }
}

export type Mode = "one_way" | "two_way"
export type OneWayOperation = "copy" | "move" | "sync"
export type ScheduleChoice = SchedulePreset | "cron"

export type EndpointValue = {
  kind: "local" | "remote"
  path: string
  remote: string
}

export type FormState = {
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

export function initialFormFor(task: SyncTask | null): FormState {
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

export function valueToEndpoint(value: EndpointValue): TaskEndpoint {
  return value.kind === "remote"
    ? { kind: "remote", remote: value.remote, path: value.path }
    : { kind: "local", path: value.path }
}

export function schedulePayload(
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

export function endpointValid(value: EndpointValue): boolean {
  if (value.kind === "local") {
    return isLocalPath(value.path)
  }
  return value.remote.trim() !== "" && !isLocalPath(value.path)
}
