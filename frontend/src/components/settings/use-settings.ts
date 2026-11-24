import { useCallback, useEffect, useState } from "react"

import { call } from "@/lib/client"
import type { SettingsDocument, SettingsPatchBody } from "@/lib/types"

/**
 * 设置文档的加载与更新：设置页三个分区各自独立使用，
 * patch 成功后直接持有服务端返回的最新文档。
 */
export function useSettingsDocument() {
  const [document, setDocument] = useState<SettingsDocument | null>(null)

  const load = useCallback(async () => {
    try {
      setDocument(await call<SettingsDocument>("/api/settings"))
    } catch {
      // call() 已经弹出错误提示；保持加载占位即可。
    }
  }, [])

  const patch = useCallback(async (body: SettingsPatchBody) => {
    const next = await call<SettingsDocument>("/api/settings", {
      method: "PATCH",
      body,
    })
    setDocument(next)
    return next
  }, [])

  useEffect(() => {
    const run = async () => {
      await load()
    }
    void run()
  }, [load])

  return { document, load, patch }
}
