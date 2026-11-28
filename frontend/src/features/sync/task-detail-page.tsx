import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router"
import { ArrowLeftIcon } from "lucide-react"

import { EmptyHint, LoadingBlock } from "@/components/common/notes"
import {
  PageContainer,
  PageHeader,
  SectionHeading,
} from "@/components/common/page-header"
import { StatusChip } from "@/components/common/status-chip"
import { Button } from "@/components/ui/button"
import { ActiveJobRow } from "@/features/sync/components/job-rows"
import { RunRow } from "@/features/sync/components/run-list"
import { endpointLabel, operationLabel } from "@/features/sync/labels"
import {
  TERMINAL_JOB_STATUSES,
  subscribeSyncJobs,
  useSyncStore,
} from "@/features/sync/sync-store"
import { callQuiet } from "@/lib/http/client"
import type { SyncRun } from "@/lib/types"
import { formatBytes, runDuration } from "@/lib/format"

const RUNS_PAGE_SIZE = 50

/**
 * 单个同步任务的执行记录页（/tasks/:taskId）。
 * 顶部是任务概览与正在进行的运行，下面是该任务在 bbolt 里的每次执行记录。
 */
export function TaskDetailPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const task = useSyncStore((state) =>
    taskId ? (state.tasks.find((item) => item.id === taskId) ?? null) : null
  )
  const tasksLoaded = useSyncStore((state) => state.loaded)
  const jobs = useSyncStore((state) => state.jobs)
  const load = useSyncStore((state) => state.load)
  const stopJob = useSyncStore((state) => state.stopJob)

  const [runs, setRuns] = useState<SyncRun[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  // “加载更多”按当前长度计算偏移；ref 让 fetchRuns 保持稳定引用。
  const runsRef = useRef<SyncRun[]>([])

  const fetchRuns = useCallback(
    async (append: boolean) => {
      if (!taskId) {
        return
      }
      const offset = append ? runsRef.current.length : 0
      try {
        const data = await callQuiet<{
          runs: SyncRun[]
          total: number
        }>(
          `/api/sync/tasks/${encodeURIComponent(taskId)}/runs?limit=${RUNS_PAGE_SIZE}&offset=${offset}`
        )
        const fetched = data.runs ?? []
        runsRef.current = append ? [...runsRef.current, ...fetched] : fetched
        setRuns(runsRef.current)
        setTotal(data.total ?? 0)
      } catch {
        // callQuiet 已处理 401；历史库不可用时展示为空列表。
      } finally {
        setLoading(false)
      }
    },
    [taskId]
  )

  // fetchRuns 通过 ref 供各 effect 调用，避免依赖数组与 lint 规则打架。
  const fetchRunsRef = useRef(fetchRuns)
  useEffect(() => {
    fetchRunsRef.current = fetchRuns
  }, [fetchRuns])

  useEffect(() => {
    void load()
    void fetchRunsRef.current(false)
    return subscribeSyncJobs()
    // taskId 语义上是本 effect 的依赖（切换任务时重新拉取），只是被 ref 内部闭包隐藏了。
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [load, taskId])

  // 正在进行的运行落定（从列表里消失）后，重新拉取第一页拿到终态记录。
  const activeJob = jobs.find(
    (item) => item.edge_id === taskId && !TERMINAL_JOB_STATUSES.has(item.status)
  )
  const hadActive = useRef(false)
  useEffect(() => {
    if (hadActive.current && !activeJob) {
      void fetchRunsRef.current(false)
    }
    hadActive.current = Boolean(activeJob)
  }, [activeJob])

  const latestRun = runs[0] ?? null
  const taskFound = !tasksLoaded || task !== null

  return (
    <PageContainer>
      <PageHeader
        title={task?.name ?? t("sync.runsTitle")}
        description={
          task
            ? `${endpointLabel(task.source)} → ${endpointLabel(task.target)}`
            : t("sync.runsDescription")
        }
        actions={
          <Button variant="outline" onClick={() => navigate("/tasks")}>
            <ArrowLeftIcon data-icon="inline-start" />
            {t("sync.backToList")}
          </Button>
        }
      />

      {!taskFound ? (
        <EmptyHint>{t("sync.taskNotFound")}</EmptyHint>
      ) : (
        <>
          {task ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{operationLabel(task, t)}</span>
              <span>{t("sync.totalRuns", { count: total })}</span>
              {latestRun ? (
                <span className="flex min-w-0 items-center gap-1">
                  {t("sync.lastResult")}
                  <StatusChip status={latestRun.status} />
                  <span>
                    {runDuration(latestRun.started_at, latestRun.finished_at)}
                    {latestRun.stats
                      ? ` · ${formatBytes(latestRun.stats.bytes)}`
                      : ""}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}

          {activeJob ? (
            <ActiveJobRow
              job={activeJob}
              onStop={() => void stopJob(activeJob.id)}
            />
          ) : null}

          <section className="flex flex-col gap-3">
            <SectionHeading title={t("sync.runsTitle")} />
            {loading && runs.length === 0 ? (
              <LoadingBlock>{t("sync.loadingRuns")}</LoadingBlock>
            ) : runs.length === 0 ? (
              <EmptyHint>{t("sync.noRuns")}</EmptyHint>
            ) : (
              <>
                {runs.map((run) => (
                  <RunRow
                    key={run.id}
                    run={run}
                    expanded={expanded === run.id}
                    onToggle={() =>
                      setExpanded((current) =>
                        current === run.id ? null : run.id
                      )
                    }
                  />
                ))}
                {runs.length < total ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void fetchRuns(true)}
                  >
                    {t("sync.loadMore")}
                  </Button>
                ) : null}
              </>
            )}
          </section>
        </>
      )}
    </PageContainer>
  )
}
