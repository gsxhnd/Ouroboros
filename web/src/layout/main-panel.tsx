import { Outlet } from "react-router"

export function MainPanel() {
  return (
    <main className="flex h-full min-w-0 flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </div>
    </main>
  )
}
