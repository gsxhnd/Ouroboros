import assert from "node:assert/strict"
import { test } from "node:test"

import i18next from "i18next"

import en from "./locales/en.json" with { type: "json" }
import zh from "./locales/zh.json" with { type: "json" }

async function translator(lng: "en" | "zh") {
  const instance = i18next.createInstance()
  await instance.init({
    lng,
    fallbackLng: "zh",
    resources: { en: { translation: en }, zh: { translation: zh } },
    interpolation: { escapeValue: false },
  })
  return instance
}

const COUNT_KEYS = [
  "tray.mountedCount",
  "tray.runningCount",
  "tray.moreJobs",
  "sync.errorCount",
  "remotes.moreTypes",
  "storage.usedBy",
]

test("English counts use the singular for exactly 1 and the plural otherwise", async () => {
  const t = (await translator("en")).t
  assert.equal(t("sync.errorCount", { count: 1 }), "1 error")
  assert.equal(t("sync.errorCount", { count: 0 }), "0 errors")
  assert.equal(t("sync.errorCount", { count: 2 }), "2 errors")
  assert.equal(t("tray.moreJobs", { count: 1 }), "1 more job")
  assert.equal(t("tray.moreJobs", { count: 3 }), "3 more jobs")
  assert.equal(t("storage.usedBy", { count: 1 }), "1 sync task")
  assert.equal(t("storage.usedBy", { count: 4 }), "4 sync tasks")
  assert.match(t("remotes.moreTypes", { count: 1 }), /remaining 1 type\.$/)
  assert.match(t("remotes.moreTypes", { count: 9 }), /remaining 9 types\.$/)
})

test("Chinese has no plural forms, so every count renders the same wording", async () => {
  const t = (await translator("zh")).t
  assert.equal(t("sync.errorCount", { count: 1 }), "1 个错误")
  assert.equal(t("sync.errorCount", { count: 7 }), "7 个错误")
  assert.equal(t("tray.moreJobs", { count: 1 }), "还有 1 个任务")
})

test("every count-based message resolves in both languages and never shows a raw key", async () => {
  for (const lng of ["en", "zh"] as const) {
    const t = (await translator(lng)).t
    for (const key of COUNT_KEYS) {
      for (const count of [0, 1, 2, 11]) {
        const out = t(key, { count })
        assert.notEqual(
          out,
          key,
          `${lng} ${key} (${count}) fell through to the key`
        )
        assert.ok(
          out.includes(String(count)),
          `${lng} ${key} (${count}) lost its number: ${out}`
        )
      }
    }
  }
})
