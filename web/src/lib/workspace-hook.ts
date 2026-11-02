import { useCallback, useEffect, useState } from "react"

import { call } from "@/lib/client"
import type { WorkspaceDocument } from "@/lib/types"

export function useWorkspace() {
  const [doc, setDoc] = useState<WorkspaceDocument | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setDoc(await call<WorkspaceDocument>("/api/workspace"))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载失败")
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
