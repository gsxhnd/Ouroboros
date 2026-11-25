import assert from "node:assert/strict"
import { test } from "node:test"

import en from "./locales/en.json" with { type: "json" }
import zh from "./locales/zh.json" with { type: "json" }

type Tree = { [key: string]: string | Tree }

function leaves(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [`${prefix}${key}`]
      : leaves(value, `${prefix}${key}.`)
  )
}

// English spells plurals as key_one / key_other; Chinese only needs key_other.
// Compare on the base key so the two languages can differ in plural forms only.
const base = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, "")

const enBase = new Set(leaves(en as Tree).map(base))
const zhBase = new Set(leaves(zh as Tree).map(base))

test("English and Chinese define the same messages", () => {
  const onlyEn = [...enBase].filter((key) => !zhBase.has(key))
  const onlyZh = [...zhBase].filter((key) => !enBase.has(key))
  assert.deepEqual(onlyEn, [], "keys missing from zh.json")
  assert.deepEqual(onlyZh, [], "keys missing from en.json")
})

test("every message has a value", () => {
  for (const [name, tree] of [
    ["en", en],
    ["zh", zh],
  ] as const) {
    for (const key of leaves(tree as Tree)) {
      const value = key
        .split(".")
        .reduce<unknown>((node, part) => (node as Tree)[part], tree)
      assert.ok(
        typeof value === "string" && value.trim() !== "",
        `${name}.json ${key} is empty`
      )
    }
  }
})

test("a message uses the same {{placeholders}} in both languages", () => {
  const placeholders = (text: string) =>
    [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort()
  const get = (tree: Tree, key: string) =>
    key
      .split(".")
      .reduce<unknown>((node, part) => (node as Tree)?.[part], tree) as
      | string
      | undefined
  for (const key of leaves(en as Tree)) {
    const zhKey = [key, `${base(key)}_other`].find(
      (candidate) => get(zh as Tree, candidate) !== undefined
    )
    if (!zhKey) continue
    assert.deepEqual(
      placeholders(get(en as Tree, key)!),
      placeholders(get(zh as Tree, zhKey)!),
      `placeholders differ for ${key}`
    )
  }
})
