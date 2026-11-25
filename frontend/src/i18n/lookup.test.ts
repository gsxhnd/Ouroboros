import assert from "node:assert/strict"
import { test } from "node:test"

import { translateOr } from "./lookup.ts"

const fake = (messages: Record<string, string>) => ({
  exists: (key: string) => key in messages,
  t: (key: string) => messages[key],
})

test("translateOr returns the translation when the key exists", () => {
  assert.equal(
    translateOr(fake({ "a.b": "Hello" }), "a.b", "fallback"),
    "Hello"
  )
})

test("translateOr returns the fallback when the key is missing", () => {
  assert.equal(translateOr(fake({}), "a.b", "fallback"), "fallback")
})

test("translateOr keeps an empty translation instead of falling back", () => {
  assert.equal(translateOr(fake({ "a.b": "" }), "a.b", "fallback"), "")
})
