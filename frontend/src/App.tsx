import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import { AppShell } from "@/components/app-shell"
import { TokenGate } from "@/components/token-gate"
import { TrayPanel } from "@/components/tray-panel"
import {
  ConnectionSection,
  RuntimeSection,
  ShortcutsSection,
} from "@/components/settings/sections"
import { isTrayView } from "@/lib/platform"
import { ApiPlaygroundPage } from "@/pages/api-playground"
import { FilesPage } from "@/pages/files"
import { OverviewPage } from "@/pages/overview"
import { SettingsPage } from "@/pages/settings"
import { StoragesPage } from "@/pages/storages"
import { SyncPage } from "@/pages/sync"

/**
 * 路由即视图：侧边栏分组与命令面板共用 lib/nav 中的路径。
 * `/` 重定向到任务首页；设置页内部分为三个子路由。
 * 托盘小面板（?view=tray）是独立入口，不进入路由。
 */
export function App() {
  if (isTrayView) {
    return <TrayPanel />
  }

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/tasks" replace />} />
            <Route path="tasks" element={<SyncPage />} />
            <Route path="files" element={<FilesPage />} />
            <Route path="storages" element={<StoragesPage />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="settings" element={<SettingsPage />}>
              <Route index element={<Navigate to="connection" replace />} />
              <Route path="connection" element={<ConnectionSection />} />
              <Route path="shortcuts" element={<ShortcutsSection />} />
              <Route path="runtime" element={<RuntimeSection />} />
            </Route>
            <Route path="api" element={<ApiPlaygroundPage />} />
            <Route path="*" element={<Navigate to="/tasks" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <TokenGate />
    </>
  )
}

export default App
