import { useTranslation } from "react-i18next"
import { PlugZapIcon, PlayIcon, SquareIcon } from "lucide-react"

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { HttpMethod } from "@/lib/api"

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"]

/** 请求编辑：方法、路径、JSON body 与发送 / SSE 连接。 */
export function RequestForm({
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
                <Select
                  value={method}
                  onValueChange={(next) =>
                    onMethodChange((next ?? method) as HttpMethod)
                  }
                >
                  <SelectTrigger id="request-method" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HTTP_METHODS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
