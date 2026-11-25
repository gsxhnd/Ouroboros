// Stands in for "@/i18n" under `node --test`: returns the key and its
// interpolated values, so tests can assert which message was chosen without
// booting i18next or loading the locale files.
const i18n = {
  t(key: string, values?: Record<string, unknown>): string {
    return values ? `${key} ${JSON.stringify(values)}` : key
  },
}

export default i18n
