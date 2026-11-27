import { useEffect, useId, useMemo, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"

import { AreaChart } from "@/components/charts/area-chart"
import { DonutChart, type DonutSlice } from "@/components/charts/donut-chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { locatorLabel, operationLabel } from "@/features/sync/labels"
import {
  recordSpeeds,
  visibleSeries,
  type SpeedJob,
  type SpeedSeries,
} from "@/features/sync/speed-samples"
import { TERMINAL_JOB_STATUSES } from "@/features/sync/sync-store"
import { formatBytes } from "@/lib/format"
import type { JobSnapshot, SyncOperation, SyncTask } from "@/lib/types"

const OPERATIONS: SyncOperation[] = ["sync", "copy", "move", "bisync"]

/** 任务列表上方：操作占比，以及正在运行的任务的实时速度。 */
export function SyncCharts({
  tasks,
  jobs,
}: {
  tasks: SyncTask[]
  jobs: JobSnapshot[]
}) {
  const { t } = useTranslation()
  const slices = useMemo(() => operationSlices(tasks, t), [tasks, t])
  const liveJobs = useMemo(() => speedJobs(jobs, t), [jobs, t])
  const samples = useSpeedSamples(liveJobs)

  return (
    <div className="grid gap-3 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{t("sync.mixTitle")}</CardTitle>
          <CardDescription>{t("sync.mixDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DonutChart slices={slices} centerLabel={t("sync.taskList")} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("sync.speedTitle")}</CardTitle>
          <CardDescription>{t("sync.speedDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AreaChart
            series={samples}
            formatY={(value) => `${formatBytes(value)}/s`}
            ariaLabel={t("sync.speedAria")}
            empty={t("sync.speedWaiting")}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function operationSlices(
  tasks: SyncTask[],
  t: (key: string) => string
): DonutSlice[] {
  const counts = new Map<SyncOperation, number>()
  for (const task of tasks) {
    counts.set(task.operation, (counts.get(task.operation) ?? 0) + 1)
  }
  return OPERATIONS.map((operation) => ({
    id: operation,
    label: operationLabel({ operation }, t),
    value: counts.get(operation) ?? 0,
  }))
}

function speedJobs(
  jobs: JobSnapshot[],
  t: (key: string) => string
): SpeedJob[] {
  return jobs
    .filter((job) => !TERMINAL_JOB_STATUSES.has(job.status))
    .map((job) => ({
      id: job.id,
      label: `${operationLabel(job, t)} · ${locatorLabel(job.source)}`,
      speed: job.progress.speed,
      active: true,
    }))
}

type SampleStore = {
  series: SpeedSeries[]
  listeners: Set<() => void>
}

const sampleStores = new Map<string, SampleStore>()

function sampleStore(id: string): SampleStore {
  const existing = sampleStores.get(id)
  if (existing) {
    return existing
  }
  const created: SampleStore = { series: [], listeners: new Set() }
  sampleStores.set(id, created)
  return created
}

function publish(store: SampleStore, series: SpeedSeries[]) {
  store.series = series
  for (const listener of store.listeners) {
    listener()
  }
}

/**
 * 把运行中任务的速度按时间攒成曲线。采样存在组件外的小仓库里，
 * 这样追加一个点不会在 effect 里同步 setState。没有新采样时，
 * 定时器仍会按窗口丢掉过期的点。
 */
function useSpeedSamples(jobs: SpeedJob[]): SpeedSeries[] {
  const id = useId()
  const store = sampleStore(id)
  const series = useSyncExternalStore(
    (listener) => {
      store.listeners.add(listener)
      return () => store.listeners.delete(listener)
    },
    () => store.series
  )

  useEffect(() => {
    const now = Date.now()
    publish(store, visibleSeries(recordSpeeds(store.series, jobs, now), now))
  }, [jobs, store])

  useEffect(() => {
    if (series.length === 0) {
      return
    }
    const timer = window.setInterval(() => {
      const now = Date.now()
      const next = visibleSeries(store.series, now)
      const changed =
        next.length !== store.series.length ||
        next.some(
          (item, index) =>
            item.points.length !== store.series[index]?.points.length
        )
      if (changed) {
        publish(store, next)
      }
    }, 5000)
    return () => window.clearInterval(timer)
  }, [series.length, store])

  useEffect(
    () => () => {
      sampleStores.delete(id)
    },
    [id]
  )

  return series
}
