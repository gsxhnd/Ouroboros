import type { SchedulePreset } from "@/stores/canvas-store"
import type { SyncOperation } from "@/lib/types"

export function operationOptions(t: (key: string) => string) {
  return [
    { value: "copy" as SyncOperation, label: t("transfers.opCopy") },
    { value: "move" as SyncOperation, label: t("transfers.opMove") },
    { value: "sync" as SyncOperation, label: t("transfers.opSync") },
  ]
}

export function scheduleOptions(t: (key: string) => string) {
  return [
    { value: "manual" as SchedulePreset, label: t("transfers.scheduleManual") },
    { value: "hourly" as SchedulePreset, label: t("transfers.scheduleHourly") },
    { value: "daily" as SchedulePreset, label: t("transfers.scheduleDaily") },
    { value: "weekly" as SchedulePreset, label: t("transfers.scheduleWeekly") },
  ]
}
