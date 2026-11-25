import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { EndpointSidebar } from "@/features/api-playground/components/endpoint-sidebar"
import { RequestForm } from "@/features/api-playground/components/request-form"
import { ResponsePane } from "@/features/api-playground/components/response-pane"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import {
  captureRevision,
  replaceJsonNumber,
} from "@/features/api-playground/request-utils"
import { openEventSource } from "@/lib/http/sse"
import {
  sendApiRequest,
  type ApiResult,
  type HttpMethod,
} from "@/lib/http/transport"
import {
  ENDPOINTS,
  endpointGroups,
  filterEndpoints,
  type Endpoint,
} from "@/features/api-playground/endpoints"
import type { SystemInfo } from "@/lib/types"

/**
 * API 演示页：端点列表 + 请求编辑 + 响应面板。
 * 桌面宽度下三栏可拖拽调整，窄屏下纵向堆叠滚动。
 */
export function ApiPlaygroundPage() {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState(ENDPOINTS[0]?.id ?? "")
  const [query, setQuery] = useState("")
  const [method, setMethod] = useState<HttpMethod>(
    ENDPOINTS[0]?.method ?? "GET"
  )
  const [path, setPath] = useState(ENDPOINTS[0]?.path ?? "/health")
  const [body, setBody] = useState(ENDPOINTS[0]?.body ?? "")
  const [sse, setSse] = useState(ENDPOINTS[0]?.sse ?? false)
  const [pending, setPending] = useState(false)
  const [listening, setListening] = useState(false)
  const [result, setResult] = useState<ApiResult | null>(null)
  const [sseLog, setSseLog] = useState("")
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [online, setOnline] = useState<boolean | null>(null)
  const [revision, setRevision] = useState<number>()
  const abortRef = useRef<AbortController | null>(null)
  const sseRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      sseRef.current?.()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const response = await sendApiRequest({
        method: "GET",
        path: "/api/system/info",
        body: "",
      })
      if (cancelled) {
        return
      }
      if (response.status === 0) {
        setOnline(false)
        return
      }
      setOnline(response.ok)
      if (response.json && typeof response.json === "object") {
        setInfo(response.json as SystemInfo)
      }
    }

    void load()
    const timer = window.setInterval(() => {
      void load()
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const applyEndpoint = (endpoint: Endpoint) => {
    setSelectedId(endpoint.id)
    setMethod(endpoint.method)
    setPath(endpoint.path)
    setBody(endpoint.body ?? "")
    setSse(endpoint.sse ?? false)
  }

  const handleSend = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPending(true)
    setSseLog("")
    const response = await sendApiRequest({
      method,
      path,
      body,
      signal: controller.signal,
    })
    if (abortRef.current !== controller) {
      return
    }
    setPending(false)
    if (controller.signal.aborted) {
      return
    }
    setResult(response)
    const nextRevision = captureRevision(response.json)
    if (nextRevision !== undefined) {
      setRevision(nextRevision)
    }
    if (response.status === 0) {
      toast.error(response.statusText)
      return
    }
    if (response.ok) {
      toast.success(`${method} ${response.status}`)
      return
    }
    toast.error(`${method} ${response.status}`)
  }

  const handleSseToggle = () => {
    if (listening) {
      sseRef.current?.()
      sseRef.current = null
      setListening(false)
      toast.info(t("api.sseDisconnected"))
      return
    }

    setResult(null)
    setSseLog("")
    setListening(true)
    sseRef.current = openEventSource(
      path,
      (eventName, data) => {
        setSseLog((current) => {
          const line = `[${eventName}] ${data}`
          return current ? `${current}\n${line}` : line
        })
      },
      (message) => {
        setListening(false)
        sseRef.current = null
        toast.error(message)
      }
    )
    toast.success(t("api.sseConnected"))
  }

  const filtered = filterEndpoints(query)
  const groups = endpointGroups(filtered)
  const rcloneRunning = Boolean(info?.rclone?.running)

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-lg leading-tight font-semibold tracking-tight">
              {t("api.title")}
            </h1>
            <Badge variant={online ? "secondary" : "destructive"}>
              {online == null
                ? t("api.checking")
                : online
                  ? t("api.online")
                  : t("api.offline")}
            </Badge>
            <Badge variant={rcloneRunning ? "default" : "outline"}>
              {rcloneRunning ? t("api.rcloneRunning") : t("api.rcloneStopped")}
            </Badge>
            {info?.version ? (
              <Badge variant="outline">v{info.version}</Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {info?.home_dir
              ? t("api.home", { path: info.home_dir })
              : t("api.homeHint")}
          </p>
        </div>
        {revision !== undefined ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBody((current) =>
                revision === undefined
                  ? current
                  : replaceJsonNumber(current, "revision", revision)
              )
            }}
          >
            {t("api.insertRevision", { revision })}
          </Button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto lg:hidden">
        <EndpointSidebar
          query={query}
          onQueryChange={setQuery}
          groups={groups}
          endpoints={filtered}
          selectedId={selectedId}
          onSelect={applyEndpoint}
        />
        <Separator />
        <RequestForm
          method={method}
          path={path}
          body={body}
          sse={sse}
          pending={pending}
          listening={listening}
          onMethodChange={setMethod}
          onPathChange={setPath}
          onBodyChange={setBody}
          onSend={() => {
            void handleSend()
          }}
          onSseToggle={handleSseToggle}
        />
        <Separator />
        <ResponsePane result={result} sseLog={sseLog} listening={listening} />
      </div>
      <div className="hidden min-h-0 flex-1 lg:flex">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={28} minSize={18} className="min-w-0">
            <EndpointSidebar
              query={query}
              onQueryChange={setQuery}
              groups={groups}
              endpoints={filtered}
              selectedId={selectedId}
              onSelect={applyEndpoint}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={72} minSize={40} className="min-w-0">
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel defaultSize={48} minSize={30} className="min-w-0">
                <RequestForm
                  method={method}
                  path={path}
                  body={body}
                  sse={sse}
                  pending={pending}
                  listening={listening}
                  onMethodChange={setMethod}
                  onPathChange={setPath}
                  onBodyChange={setBody}
                  onSend={() => {
                    void handleSend()
                  }}
                  onSseToggle={handleSseToggle}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={52} minSize={24} className="min-w-0">
                <ResponsePane
                  result={result}
                  sseLog={sseLog}
                  listening={listening}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
