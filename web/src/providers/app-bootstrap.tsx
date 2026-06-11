import { useCallback, useEffect, useState, type ReactNode } from "react"

import { AppInitFailurePage } from "@/pages/app-init-failure-page"
import { AppLoadingPage } from "@/pages/app-loading-page"
import { useSystemStore } from "@/stores/system"

const MIN_LOADING_MS = 500

interface AppBootstrapProps {
  children: ReactNode
}

async function waitForMinimumLoading(startedAt: number) {
  const remaining = MIN_LOADING_MS - (Date.now() - startedAt)
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining))
  }
}

export function AppBootstrap({ children }: AppBootstrapProps) {
  const status = useSystemStore((state) => state.status)
  const systemInfo = useSystemStore((state) => state.systemInfo)
  const loading = useSystemStore((state) => state.loading)
  const error = useSystemStore((state) => state.error)
  const refresh = useSystemStore((state) => state.refresh)
  const [attempted, setAttempted] = useState(false)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    let cancelled = false
    const startedAt = Date.now()

    void refresh()
      .finally(async () => {
        if (cancelled) {
          return
        }

        const { status, systemInfo } = useSystemStore.getState()
        const succeeded = status === "online" && systemInfo !== null

        if (succeeded) {
          await waitForMinimumLoading(startedAt)
        }

        if (!cancelled) {
          setAttempted(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [refresh])

  const handleRetry = useCallback(async () => {
    setRetrying(true)
    setAttempted(false)
    const startedAt = Date.now()
    await refresh()

    const { status, systemInfo } = useSystemStore.getState()
    const succeeded = status === "online" && systemInfo !== null

    if (succeeded) {
      await waitForMinimumLoading(startedAt)
    }

    setAttempted(true)
    setRetrying(false)
  }, [refresh])

  const isReady = attempted && status === "online" && systemInfo !== null
  const isLoading = !attempted || loading

  if (isLoading) {
    return <AppLoadingPage />
  }

  if (!isReady) {
    return (
      <AppInitFailurePage
        error={error}
        retrying={retrying}
        onRetry={() => void handleRetry()}
      />
    )
  }

  return children
}
