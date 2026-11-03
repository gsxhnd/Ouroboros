import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import en from "./locales/en.json"
import zh from "./locales/zh.json"

export const LOCALES = ["zh", "en"] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = "zh"

const STORAGE_KEY = "ourboros.lang"

function detectLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && (LOCALES as readonly string[]).includes(stored)) {
      return stored as Locale
    }
  } catch {
    // localStorage 不可用时跳过，继续探测系统语言。
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en"
}

void i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: detectLocale(),
  fallbackLng: DEFAULT_LOCALE,
  // React 自己会转义插值，i18next 不需要再转义一遍。
  interpolation: { escapeValue: false },
})

/** 切换界面语言并记住选择；用于语言切换按钮等非 Hook 场景。 */
export function changeLanguage(next: Locale): void {
  void i18n.changeLanguage(next)
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // 忽略存储失败，语言切换在本次会话内仍然生效。
  }
  document.documentElement.lang = next
}

document.documentElement.lang = i18n.language

export default i18n
