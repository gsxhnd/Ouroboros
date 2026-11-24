import { useCallback, useEffect, useState } from "react"

import { call } from "@/lib/client"
import i18n from "@/i18n"
import type { WorkspaceDocument } from "@/lib/types"

export function useWorkspace() {
  const [doc, setDoc] = useState<WorkspaceDocument | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setDoc(await call<WorkspaceDocument>("/api/workspace"))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : i18n.t("errors.loadFailed"))
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      await reload()
    }
    void run()
  }, [reload])

  return { doc, error, reload }
}
