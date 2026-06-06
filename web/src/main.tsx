import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import "./i18n"
import { AppRouter } from "@/router"
import { ThemeProvider } from "@/components/theme-provider"
import { resolveApiBaseUrl } from "@/services/http"

async function bootstrap() {
  await resolveApiBaseUrl()

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider>
        <AppRouter />
      </ThemeProvider>
    </StrictMode>,
  )
}

void bootstrap()
