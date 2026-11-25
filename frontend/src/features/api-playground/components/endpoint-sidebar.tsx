import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Endpoint } from "@/features/api-playground/endpoints"
import type { HttpMethod } from "@/lib/http/transport"

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

/** 左侧端点列表：按分组展示，可按名称 / 路径过滤。 */
export function EndpointSidebar({
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
        <FieldLabel htmlFor="endpoint-filter">
          {t("api.filterLabel")}
        </FieldLabel>
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
                      className="h-auto w-full min-w-0 justify-start py-2"
                      title={t(endpoint.descriptionKey)}
                      onClick={() => onSelect(endpoint)}
                    >
                      <Badge
                        variant={methodVariant(endpoint.method)}
                        className="font-mono"
                      >
                        {endpoint.method}
                      </Badge>
                      <span className="min-w-0 truncate">{endpoint.name}</span>
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
