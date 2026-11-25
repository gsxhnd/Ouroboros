import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatResponseBody } from "@/features/api-playground/request-utils"
import { type ApiResult } from "@/lib/http/transport"
import { cn } from "cn"

/** 响应面板：JSON 美化展示或 SSE 日志流。 */
export function ResponsePane({
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
              {result.status || t("api.statusError")} {result.statusText}
            </Badge>
          ) : null}
          {result ? <Badge variant="outline">{result.ms}ms</Badge> : null}
          {listening ? (
            <Badge variant="default">{t("api.sseLive")}</Badge>
          ) : null}
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
