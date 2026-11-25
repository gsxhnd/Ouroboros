/** The part of an i18next instance that lookups need. */
export type Translator = {
  exists: (key: string) => boolean
  t: (key: string) => string
}

/**
 * Translates `key` when the locale files have it, otherwise returns
 * `fallback`. Used for open-ended values such as rclone provider and mode
 * names, where only the ones we know get a localised label.
 */
export function translateOr(
  i18n: Translator,
  key: string,
  fallback: string
): string {
  return i18n.exists(key) ? i18n.t(key) : fallback
}
