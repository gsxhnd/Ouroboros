import { useTranslation } from "react-i18next"

import { SelectField } from "@/components/common/select-field"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  helpSummary,
  isCredential,
  visibleExamples,
  type FieldValue,
} from "@/features/storages/remote-form/model"
import type { RemoteOption } from "@/lib/types"

export function OptionControl({
  option,
  provider,
  value,
  editing,
  onChange,
}: {
  option: RemoteOption
  provider: string
  value: FieldValue | undefined
  editing: boolean
  onChange: (value: FieldValue) => void
}) {
  const { t } = useTranslation()
  const id = `remote-opt-${option.name}`
  const help = helpSummary(option.help)
  const secret = isCredential(option)
  const examples = visibleExamples(option, provider)
  const text = typeof value === "string" ? value : ""

  if (option.type === "bool") {
    return (
      <Field orientation="horizontal">
        <Checkbox
          id={id}
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked)}
        />
        <FieldContent>
          <FieldLabel htmlFor={id}>{option.name}</FieldLabel>
          {help ? (
            <FieldDescription title={option.help}>{help}</FieldDescription>
          ) : null}
        </FieldContent>
      </Field>
    )
  }

  if (option.type === "Tristate") {
    return (
      <SelectField
        label={option.name}
        value={text}
        placeholder={t("remotes.useDefault")}
        options={[
          { value: "true", label: t("common.yes") },
          { value: "false", label: t("common.no") },
        ]}
        onChange={onChange}
      />
    )
  }

  if (option.exclusive && examples.length > 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <SelectField
          label={optionLabel(option)}
          value={examples.some((example) => example.value === text) ? text : ""}
          placeholder={
            option.required ? t("remotes.selectRequired") : t("remotes.unset")
          }
          options={examples.map((example) => ({
            value: example.value,
            label:
              example.help && example.help.length <= 48
                ? `${example.value} · ${helpSummary(example.help)}`
                : example.value,
          }))}
          onChange={onChange}
        />
        {help ? (
          <p className="text-xs text-muted-foreground" title={option.help}>
            {help}
          </p>
        ) : null}
      </div>
    )
  }

  const listId = examples.length > 0 ? `${id}-list` : undefined
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {option.name}
        {option.required ? <span className="text-destructive">*</span> : null}
      </FieldLabel>
      <Input
        id={id}
        list={listId}
        type={secret ? "password" : "text"}
        value={text}
        autoComplete="off"
        className={secret ? undefined : "font-mono"}
        placeholder={
          secret && editing ? t("remotes.keepOriginal") : (option.default ?? "")
        }
        onChange={(event) => onChange(event.target.value)}
      />
      {listId ? (
        <datalist id={listId}>
          {examples.map((example) => (
            <option key={example.value} value={example.value}>
              {example.help}
            </option>
          ))}
        </datalist>
      ) : null}
      {help ? (
        <FieldDescription title={option.help}>{help}</FieldDescription>
      ) : null}
    </Field>
  )
}

function optionLabel(option: RemoteOption) {
  return option.required ? `${option.name} *` : option.name
}
