import { useState } from "react"

import { AppShell, type PageId } from "@/components/app-shell"
import { ApiPlayground } from "@/components/api-playground"
import { TrayPanel } from "@/components/tray-panel"
import { isTrayView } from "@/lib/platform"
import { FilesPage } from "@/pages/files"
import { MountsPage } from "@/pages/mounts"
import { OverviewPage } from "@/pages/overview"
import { RemotesPage } from "@/pages/remotes"
import { SettingsPage } from "@/pages/settings"
import { TransfersPage } from "@/pages/transfers"

export function App() {
  const [page, setPage] = useState<PageId>("overview")

  if (isTrayView) {
    return <TrayPanel />
  }

  return (
    <AppShell page={page} onPageChange={setPage}>
      {page === "overview" ? <OverviewPage /> : null}
      {page === "files" ? <FilesPage /> : null}
      {page === "remotes" ? <RemotesPage /> : null}
      {page === "transfers" ? <TransfersPage /> : null}
      {page === "mounts" ? <MountsPage /> : null}
      {page === "settings" ? <SettingsPage /> : null}
      {page === "api" ? <ApiPlayground /> : null}
    </AppShell>
  )
}

export default App
