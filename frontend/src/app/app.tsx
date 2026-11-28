import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import { AppShell } from "@/app/shell/app-shell"
import { TokenGate } from "@/app/shell/token-gate"
import { TrayPanel } from "@/features/tray/tray-panel"
import {
  ConnectionSection,
  RuntimeSection,
  ShortcutsSection,
} from "@/features/settings/sections"
import { BinarySection } from "@/features/settings/binary-section"
import { isTrayView } from "@/lib/platform"
import { ApiPlaygroundPage } from "@/features/api-playground/api-playground-page"
import { FilesPage } from "@/features/files/files-page"
import { MountsPage } from "@/features/mounts/mounts-page"
import { OverviewPage } from "@/features/overview/overview-page"
import { SettingsPage } from "@/features/settings/settings-page"
import { StoragesPage } from "@/features/storages/storages-page"
import { SyncPage } from "@/features/sync/sync-page"
import { TaskDetailPage } from "@/features/sync/task-detail-page"

/**
 * 路由即视图：侧边栏分组与命令面板共用 lib/nav 中的路径。
 * `/` 重定向到任务首页；设置页内部分为四个子路由。
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
            <Route path="tasks/:taskId" element={<TaskDetailPage />} />
            <Route path="files" element={<FilesPage />} />
            <Route path="mounts" element={<MountsPage />} />
            <Route path="storages" element={<StoragesPage />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="settings" element={<SettingsPage />}>
              <Route index element={<Navigate to="connection" replace />} />
              <Route path="connection" element={<ConnectionSection />} />
              <Route path="binary" element={<BinarySection />} />
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
