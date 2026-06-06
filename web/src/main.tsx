import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import "./index.css"
import "./i18n"
import { AppRouter } from "@/router"
import { ThemeProvider } from "@/components/theme-provider"
import { resolveApiBaseUrl } from "@/services/http"

const queryClient = new QueryClient()

async function bootstrap() {
  await resolveApiBaseUrl()

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AppRouter />
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

void bootstrap()
