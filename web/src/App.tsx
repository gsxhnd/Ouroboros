import { useState } from "react"

import { AppShell, type PageId } from "@/components/app-shell"
import { ApiPlayground } from "@/components/api-playground"
import { FilesPage } from "@/components/pages/files"
import { MountsPage } from "@/components/pages/mounts"
import { OverviewPage } from "@/components/pages/overview"
import { RemotesPage } from "@/components/pages/remotes"
import { SettingsPage } from "@/components/pages/settings"
import { TransfersPage } from "@/components/pages/transfers"

export function App() {
  const [page, setPage] = useState<PageId>("overview")

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
