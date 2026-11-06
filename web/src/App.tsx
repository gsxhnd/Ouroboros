import { AppShell } from "@/components/app-shell"
import { TrayPanel } from "@/components/tray-panel"
import { isTrayView } from "@/lib/platform"
import { CanvasPage } from "@/pages/canvas"

export function App() {
  if (isTrayView) {
    return <TrayPanel />
  }

  return (
    <AppShell>
      <CanvasPage />
    </AppShell>
  )
}

export default App
