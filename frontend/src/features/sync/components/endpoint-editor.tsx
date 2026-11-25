import { useTranslation } from "react-i18next"

import { SelectField } from "@/components/common/select-field"
import { Input } from "@/components/ui/input"
import type { EndpointValue } from "@/features/sync/task-form-model"
import type { RemoteInfo } from "@/lib/types"

export function EndpointEditor({
  label,
  value,
  remotes,
  onChange,
}: {
  label: string
  value: EndpointValue
  remotes: RemoteInfo[]
  onChange: (value: EndpointValue) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl border p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-2">
        <SelectField<"local" | "remote">
          value={value.kind}
          options={[
            { value: "local", label: t("sync.endpointLocal") },
            { value: "remote", label: t("sync.endpointRemote") },
          ]}
          onChange={(kind) => onChange({ ...value, kind })}
        />
        {value.kind === "local" ? (
          <Input
            value={value.path}
            placeholder={t("sync.localPathPlaceholder")}
            onChange={(event) =>
              onChange({ ...value, path: event.target.value })
            }
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <SelectField
              value={value.remote}
              placeholder={t("sync.remoteSelect")}
              options={remotes.map((item) => ({
                value: item.name,
                label: item.name,
              }))}
              onChange={(remote) => onChange({ ...value, remote })}
            />
            <Input
              value={value.path}
              placeholder={t("sync.remotePathPlaceholder")}
              onChange={(event) =>
                onChange({ ...value, path: event.target.value })
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
