import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

// 原子化 Wails 桥：注册原生窗口拖拽（--wails-draggable）与标题栏双击缩放。
// 浏览器中导入它只会打印一条无害的提示日志。
import "@wailsio/runtime"

import "./index.css"
// i18n 初始化必须在渲染之前完成（语言探测 + 资源注册）。
import "./i18n"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
      <Toaster />
    </ThemeProvider>
  </StrictMode>
)
