import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Field, FieldLabel } from "@/components/ui/field"
import { translateOr } from "@/i18n/lookup"
import { Input } from "@/components/ui/input"
import type { RemoteProvider } from "@/lib/types"
import { cn } from "cn"

const FEATURED = [
  "s3",
  "sftp",
  "webdav",
  "drive",
  "dropbox",
  "onedrive",
  "b2",
  "ftp",
  "smb",
  "alias",
  "local",
  "azureblob",
]

export function TypePicker({
  providers,
  query,
  selected,
  onQuery,
  onSelect,
}: {
  providers: RemoteProvider[]
  query: string
  selected: string
  onQuery: (query: string) => void
  onSelect: (type: string) => void
}) {
  const { t, i18n } = useTranslation()
  const needle = query.trim().toLowerCase()
  const matches = useMemo(() => {
    const ranked = needle
      ? providers.filter((item) =>
          `${item.name} ${item.prefix} ${item.description}`
            .toLowerCase()
            .includes(needle)
        )
      : providers.filter((item) => FEATURED.includes(item.name))
    return [...ranked].sort((a, b) => {
      const ai = FEATURED.indexOf(a.name)
      const bi = FEATURED.indexOf(b.name)
      if (ai === -1 && bi === -1) {
        return a.name.localeCompare(b.name)
      }
      if (ai === -1) {
        return 1
      }
      if (bi === -1) {
        return -1
      }
      return ai - bi
    })
  }, [needle, providers])

  return (
    <div className="flex flex-col gap-2">
      <Field>
        <FieldLabel htmlFor="remote-type-search">{t("common.type")}</FieldLabel>
        <Input
          id="remote-type-search"
          value={query}
          placeholder={t("remotes.typeSearchPlaceholder")}
          onChange={(event) => onQuery(event.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {matches.map((item) => {
          const active = item.name === selected
          const key = `remotes.providers.${item.name}`
          return (
            <button
              key={item.name}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(item.name)}
              className={cn(
                "rounded-xl px-2.5 py-2 text-left ring-1 ring-foreground/10 transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                active && "bg-primary/10 ring-primary"
              )}
            >
              <span className="block truncate text-sm font-medium">
                {translateOr(i18n, key, item.name)}
              </span>
              <span className="line-clamp-2 text-xs text-muted-foreground">
                {item.name}
              </span>
            </button>
          )
        })}
      </div>
      {matches.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("remotes.noTypeMatch")}
        </p>
      ) : null}
      {!needle ? (
        <p className="text-xs text-muted-foreground">
          {t("remotes.moreTypes", {
            count: Math.max(providers.length - matches.length, 0),
          })}
        </p>
      ) : null}
    </div>
  )
}
