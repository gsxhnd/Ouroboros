import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  MoonIcon,
  PlayIcon,
  PlugZapIcon,
  SquareIcon,
  SunIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useTheme } from "@/components/theme-provider"
import {
  captureRevision,
  formatResponseBody,
  openEventSource,
  replaceJsonNumber,
  sendApiRequest,
  type ApiResult,
  type HttpMethod,
} from "@/lib/api"
import {
  ENDPOINTS,
  endpointGroups,
  filterEndpoints,
  type Endpoint,
} from "@/lib/endpoints"
import { cn } from "cn"

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"]

type SystemInfo = {
  name?: string
  version?: string
  home_dir?: string
  rclone?: {
    running?: boolean
    mode?: string
    version?: string | null
    binary?: string
  }
}

export function ApiPlayground() {
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
    <div className="flex h-svh flex-col bg-background">
      <PlaygroundHeader
        info={info}
        online={online}
        rcloneRunning={rcloneRunning}
        revision={revision}
        onInsertRevision={() => {
          setBody((current) =>
            revision === undefined
              ? current
              : replaceJsonNumber(current, "revision", revision)
          )
        }}
      />
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

function PlaygroundHeader({
  info,
  online,
  rcloneRunning,
  revision,
  onInsertRevision,
}: {
  info: SystemInfo | null
  online: boolean | null
  rcloneRunning: boolean
  revision: number | undefined
  onInsertRevision: () => void
}) {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const nextTheme = theme === "dark" ? "light" : "dark"

  return (
    <header className="flex items-center gap-3 border-b px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-base font-medium">{t("api.title")}</h1>
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
        <p className="truncate text-xs text-muted-foreground">
          {info?.home_dir ? `HOME ${info.home_dir}` : t("api.homeHint")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {revision !== undefined ? (
          <Button variant="outline" size="sm" onClick={onInsertRevision}>
            {t("api.insertRevision", { revision })}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(nextTheme)}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </Button>
      </div>
    </header>
  )
}

function EndpointSidebar({
  query,
  onQueryChange,
  groups,
  endpoints,
  selectedId,
  onSelect,
}: {
  query: string
  onQueryChange: (value: string) => void
  groups: string[]
  endpoints: Endpoint[]
  selectedId: string
  onSelect: (endpoint: Endpoint) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex h-full min-h-80 flex-col gap-3 p-3">
      <Field>
        <FieldLabel htmlFor="endpoint-filter">{t("api.filterLabel")}</FieldLabel>
        <Input
          id="endpoint-filter"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("api.filterPlaceholder")}
        />
      </Field>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 pr-3">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("api.noMatch")}</p>
          ) : (
            groups.map((group) => (
              <div key={group} className="flex flex-col gap-1">
                <p className="px-1 text-xs font-medium text-muted-foreground">
                  {group}
                </p>
                {endpoints
                  .filter((endpoint) => endpoint.group === group)
                  .map((endpoint) => (
                    <Button
                      key={endpoint.id}
                      variant={
                        endpoint.id === selectedId ? "secondary" : "ghost"
                      }
                      className="h-auto w-full justify-start py-2"
                      title={t(endpoint.descriptionKey)}
                      onClick={() => onSelect(endpoint)}
                    >
                      <Badge
                        variant={methodVariant(endpoint.method)}
                        className="font-mono"
                      >
                        {endpoint.method}
                      </Badge>
                      <span className="truncate">{endpoint.name}</span>
                    </Button>
                  ))}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function RequestForm({
  method,
  path,
  body,
  sse,
  pending,
  listening,
  onMethodChange,
  onPathChange,
  onBodyChange,
  onSend,
  onSseToggle,
}: {
  method: HttpMethod
  path: string
  body: string
  sse: boolean
  pending: boolean
  listening: boolean
  onMethodChange: (method: HttpMethod) => void
  onPathChange: (path: string) => void
  onBodyChange: (body: string) => void
  onSend: () => void
  onSseToggle: () => void
}) {
  const { t } = useTranslation()
  return (
    <Card size="sm" className="h-full rounded-none ring-0">
      <CardHeader className="border-b">
        <CardTitle>{t("api.request")}</CardTitle>
        <CardDescription>{t("api.requestDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!sse) {
              onSend()
            }
          }}
        >
          <FieldGroup>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Field className="sm:max-w-36">
                <FieldLabel htmlFor="request-method">Method</FieldLabel>
                <select
                  id="request-method"
                  value={method}
                  onChange={(event) =>
                    onMethodChange(event.target.value as HttpMethod)
                  }
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {HTTP_METHODS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
              <Field className="flex-1">
                <FieldLabel htmlFor="request-path">Path</FieldLabel>
                <Input
                  id="request-path"
                  value={path}
                  onChange={(event) => onPathChange(event.target.value)}
                  className="font-mono"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="request-body">JSON body</FieldLabel>
              <Textarea
                id="request-body"
                value={body}
                onChange={(event) => onBodyChange(event.target.value)}
                className="min-h-40 font-mono text-xs"
                placeholder={sse ? t("api.sseNoBody") : "{ }"}
                disabled={sse || method === "GET" || method === "DELETE"}
              />
              <FieldDescription>{t("api.methodsHint")}</FieldDescription>
            </Field>
          </FieldGroup>
          <div className="flex flex-wrap items-center gap-2">
            {sse ? (
              <Button type="button" onClick={onSseToggle}>
                {listening ? (
                  <SquareIcon data-icon="inline-start" />
                ) : (
                  <PlugZapIcon data-icon="inline-start" />
                )}
                {listening ? t("api.disconnectSse") : t("api.connectSse")}
              </Button>
            ) : (
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <PlayIcon data-icon="inline-start" />
                )}
                {t("common.send")}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              {t("api.darkHintPrefix")} <Kbd>d</Kbd> {t("api.darkHintSuffix")}
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function ResponsePane({
  result,
  sseLog,
  listening,
}: {
  result: ApiResult | null
  sseLog: string
  listening: boolean
}) {
  const { t } = useTranslation()
  const output = sseLog || (result ? formatResponseBody(result) : "")

  return (
    <Card size="sm" className="h-full rounded-none ring-0">
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <CardTitle>{t("api.response")}</CardTitle>
          {result ? (
            <Badge variant={result.ok ? "secondary" : "destructive"}>
              {result.status || "ERR"} {result.statusText}
            </Badge>
          ) : null}
          {result ? <Badge variant="outline">{result.ms}ms</Badge> : null}
          {listening ? <Badge variant="default">SSE live</Badge> : null}
        </div>
        <CardDescription>{t("api.responseDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        <pre
          className={cn(
            "h-full min-h-48 overflow-auto rounded-lg bg-muted/50 p-3 font-mono text-xs leading-relaxed"
          )}
        >
          {output || t("api.responseEmpty")}
        </pre>
      </CardContent>
    </Card>
  )
}

function methodVariant(
  method: HttpMethod
): "default" | "secondary" | "outline" | "destructive" {
  switch (method) {
    case "GET":
      return "secondary"
    case "POST":
      return "default"
    case "DELETE":
      return "destructive"
    default:
      return "outline"
  }
}
