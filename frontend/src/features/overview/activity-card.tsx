import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { DonutChart, type DonutSlice } from "@/components/charts/donut-chart"
import { CountUp } from "@/components/motion/reveal"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TERMINAL_JOB_STATUSES } from "@/features/sync/sync-store"
import { callQuiet } from "@/lib/http/client"
import type { JobSnapshot, MountSnapshot, SyncTask } from "@/lib/types"

type Pulse = {
  tasks: SyncTask[]
  jobs: JobSnapshot[]
  mounts: MountSnapshot[]
}

/**
 * 概览上的工作区脉搏：任务数、正在跑的传输、已挂上的挂载，
 * 以及各任务最近一次结果的分布。数字来自现有接口，不编造历史。
 */
export function ActivityCard() {
  const { t } = useTranslation()
  const [pulse, setPulse] = useState<Pulse | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [tasks, jobs, mounts] = await Promise.all([
        callQuiet<{ tasks: SyncTask[] }>("/api/sync/tasks").catch(() => ({
          tasks: [] as SyncTask[],
        })),
        callQuiet<{ jobs: JobSnapshot[] }>("/api/sync/jobs").catch(() => ({
          jobs: [] as JobSnapshot[],
        })),
        callQuiet<{ mounts: MountSnapshot[] }>("/api/mounts").catch(() => ({
          mounts: [] as MountSnapshot[],
        })),
      ])
      if (cancelled) {
        return
      }
      setPulse({
        tasks: tasks.tasks ?? [],
        jobs: jobs.jobs ?? [],
        mounts: mounts.mounts ?? [],
      })
    }
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const slices = useMemo(
    () => (pulse ? outcomeSlices(pulse.tasks, t) : []),
    [pulse, t]
  )

  if (!pulse) {
    return null
  }

  const running = pulse.jobs.filter(
    (job) => !TERMINAL_JOB_STATUSES.has(job.status)
  ).length
  const mounted = pulse.mounts.filter(
    (mount) => mount.status === "mounted"
  ).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("overview.pulseTitle")}</CardTitle>
        <CardDescription>{t("overview.pulseDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="grid grid-cols-3 gap-3">
          <Stat label={t("overview.statTasks")} value={pulse.tasks.length} />
          <Stat label={t("overview.statRunning")} value={running} />
          <Stat label={t("overview.statMounted")} value={mounted} />
        </dl>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("overview.outcomesTitle")}</h3>
          <DonutChart
            slices={slices}
            centerLabel={t("overview.outcomesTitle")}
            empty={t("overview.outcomesEmpty")}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-muted/50 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tracking-tight">
        <CountUp value={value} />
      </dd>
    </div>
  )
}

function outcomeSlices(
  tasks: SyncTask[],
  t: (key: string) => string
): DonutSlice[] {
  let succeeded = 0
  let failed = 0
  let other = 0
  let never = 0
  for (const task of tasks) {
    const status = task.last_result?.status
    if (!status) {
      never += 1
    } else if (status === "succeeded") {
      succeeded += 1
    } else if (status === "failed" || status === "partial_failed") {
      failed += 1
    } else {
      other += 1
    }
  }
  return [
    { id: "succeeded", label: t("overview.sliceSucceeded"), value: succeeded },
    { id: "failed", label: t("overview.sliceFailed"), value: failed },
    { id: "other", label: t("overview.sliceOther"), value: other },
    { id: "never", label: t("overview.sliceNever"), value: never },
  ]
}
