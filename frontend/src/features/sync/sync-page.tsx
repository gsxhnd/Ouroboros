import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { ConfirmNameDialog } from "@/components/common/confirm-name-dialog"
import { EmptyHint, LoadingBlock, WarningNote } from "@/components/common/notes"
import { Button } from "@/components/ui/button"
import {
  PageContainer,
  PageHeader,
  SectionHeading,
} from "@/components/common/page-header"
import { TaskDialog } from "@/features/sync/components/task-dialog"
import {
  ResyncConfirmDialog,
  RunConfirmDialog,
} from "@/features/sync/components/confirm-dialogs"
import { ActiveJobRow } from "@/features/sync/components/job-rows"
import { SyncCharts } from "@/features/sync/components/sync-charts"
import { TaskCard } from "@/features/sync/components/task-card"
import { Stagger } from "@/components/motion/reveal"
import { bisyncNeedsResync } from "@/features/sync/labels"
import { useRunsStore } from "@/features/sync/runs-store"
import { call } from "@/lib/http/client"
import type { RemoteInfo, SyncTask } from "@/lib/types"
import { useRcloneStore } from "@/stores/rclone-store"
import {
  TERMINAL_JOB_STATUSES,
  subscribeSyncJobs,
  useSyncStore,
} from "@/features/sync/sync-store"

export function SyncPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const tasks = useSyncStore((state) => state.tasks)
  const loaded = useSyncStore((state) => state.loaded)
  const jobs = useSyncStore((state) => state.jobs)
  const load = useSyncStore((state) => state.load)
  const deleteTask = useSyncStore((state) => state.deleteTask)
  const patchTask = useSyncStore((state) => state.patchTask)
  const runTask = useSyncStore((state) => state.runTask)
  const stopJob = useSyncStore((state) => state.stopJob)
  const latestRuns = useRunsStore((state) => state.latest)
  const loadLatest = useRunsStore((state) => state.loadLatest)
  const rcloneRunning = useRcloneStore(
    (state) => state.status?.running ?? false
  )

  const [remotes, setRemotes] = useState<RemoteInfo[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SyncTask | null>(null)
  const [runConfirm, setRunConfirm] = useState<SyncTask | null>(null)
  const [resyncConfirm, setResyncConfirm] = useState<SyncTask | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<SyncTask | null>(null)

  useEffect(() => {
    void load()
    void loadLatest()
    void call<{ remotes: RemoteInfo[] }>("/api/remotes")
      .then((data) => setRemotes(data.remotes))
      .catch(() => setRemotes([]))
    return subscribeSyncJobs()
  }, [load, loadLatest])

  const activeJobs = useMemo(
    () => jobs.filter((job) => !TERMINAL_JOB_STATUSES.has(job.status)),
    [jobs]
  )

  const requestRun = (task: SyncTask) => {
    if (task.destructive) {
      setRunConfirm(task)
      return
    }
    runTask(task.id).then(
      () => toast.success(t("sync.runStarted", { name: task.name })),
      () => undefined
    )
  }

  const confirmRun = async (task: SyncTask) => {
    setRunConfirm(null)
    const resync = bisyncNeedsResync(task)
    try {
      await runTask(task.id, { resync })
    } catch {
      return
    }
    toast.success(
      t(resync ? "sync.resyncStarted" : "sync.runStarted", { name: task.name })
    )
  }

  const requestResync = (task: SyncTask) => {
    if (task.last_result?.status !== "succeeded") {
      setResyncConfirm(task)
      return
    }
    runTask(task.id, { resync: true }).catch(() => undefined)
  }

  const stopTask = (task: SyncTask) => {
    const job = jobs.find(
      (item) =>
        item.edge_id === task.id && !TERMINAL_JOB_STATUSES.has(item.status)
    )
    if (job) {
      stopJob(job.id).catch(() => undefined)
    }
  }

  const confirmDelete = async (task: SyncTask) => {
    setDeleteConfirm(null)
    try {
      await deleteTask(task.id)
    } catch {
      return
    }
    toast.success(t("sync.deleteDone", { name: task.name }))
  }

  return (
    <PageContainer>
      <PageHeader
        title={t("sync.title")}
        description={t("sync.subtitle")}
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <PlusIcon data-icon="inline-start" />
            {t("sync.newTask")}
          </Button>
        }
      />

      {!rcloneRunning ? (
        <WarningNote>{t("sync.rcloneOffline")}</WarningNote>
      ) : null}

      {loaded && tasks.length > 0 ? (
        <SyncCharts tasks={tasks} jobs={jobs} />
      ) : null}

      {activeJobs.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading title={t("sync.activeJobs")} />
          {activeJobs.map((job) => (
            <ActiveJobRow
              key={job.id}
              job={job}
              onStop={() => void stopJob(job.id)}
            />
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <SectionHeading title={t("sync.taskList")} />
        {!loaded ? (
          <LoadingBlock>{t("sync.loading")}</LoadingBlock>
        ) : tasks.length === 0 ? (
          <EmptyHint>{t("sync.empty")}</EmptyHint>
        ) : (
          <Stagger>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                jobs={jobs}
                latest={latestRuns[task.id] ?? null}
                onOpen={() => navigate(`/tasks/${task.id}`)}
                onRun={() => requestRun(task)}
                onEdit={() => {
                  setEditing(task)
                  setDialogOpen(true)
                }}
                onDelete={() => setDeleteConfirm(task)}
                onToggleEnabled={(enabled) =>
                  void patchTask(task.id, { enabled })
                }
                onResync={() => requestResync(task)}
                onStop={() => stopTask(task)}
              />
            ))}
          </Stagger>
        )}
      </section>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        remotes={remotes}
      />

      <RunConfirmDialog
        task={runConfirm}
        onClose={() => setRunConfirm(null)}
        onConfirm={() => {
          if (runConfirm) {
            void confirmRun(runConfirm)
          }
        }}
      />

      <ResyncConfirmDialog
        task={resyncConfirm}
        onClose={() => setResyncConfirm(null)}
        onConfirm={() => {
          const task = resyncConfirm
          setResyncConfirm(null)
          if (task) {
            void runTask(task.id, { resync: true })
          }
        }}
      />

      <ConfirmNameDialog
        open={deleteConfirm !== null}
        title={t("sync.deleteTitle")}
        warning={t("sync.deleteWarning", {
          name: deleteConfirm?.name ?? "",
        })}
        expectedName={deleteConfirm?.name ?? null}
        confirmLabel={t("common.delete")}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) {
            void confirmDelete(deleteConfirm)
          }
        }}
      />
    </PageContainer>
  )
}
