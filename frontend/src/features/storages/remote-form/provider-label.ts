import i18n from "@/i18n"
import { translateOr } from "@/i18n/lookup"

/** 面向用户的 remote 类型名；未收录的类型回退到 rclone 的类型 id。 */
export function providerLabel(type: string | null | undefined): string {
  if (!type) {
    return i18n.t("remotes.untyped")
  }
  return translateOr(i18n, `remotes.providers.${type}`, type)
}
