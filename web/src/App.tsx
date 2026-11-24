import { AppShell } from "@/components/app-shell"
import { TrayPanel } from "@/components/tray-panel"
import { isTrayView } from "@/lib/platform"
import { SyncPage } from "@/pages/sync"

export function App() {
  if (isTrayView) {
    return <TrayPanel />
  }

  return (
    <AppShell>
      <SyncPage />
    </AppShell>
  )
}

export default App
