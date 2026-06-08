import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import { AppLayout } from "@/layout"
import { HomePage } from "@/pages/home-page"
import { LibraryPage } from "@/pages/library-page"
import { SettingsPage } from "@/pages/settings-page"
import { SystemPage } from "@/pages/system-page"

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="system" element={<SystemPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
