import assert from "node:assert/strict"
import { test } from "node:test"

import { formatBytes, formatTime } from "./format.ts"

test("formatBytes uses the largest unit below 1024", () => {
  assert.equal(formatBytes(0), "0 B")
  assert.equal(formatBytes(1023), "1023 B")
  assert.equal(formatBytes(1024), "1.0 KB")
  assert.equal(formatBytes(1536), "1.5 KB")
  assert.equal(formatBytes(5 * 1024 ** 3), "5.0 GB")
})

test("formatBytes shows a dash for missing values", () => {
  assert.equal(formatBytes(null), "—")
  assert.equal(formatBytes(Number.NaN), "—")
})

test("formatTime shows a dash for missing values and echoes unparseable ones", () => {
  assert.equal(formatTime(null), "—")
  assert.equal(formatTime(undefined), "—")
  assert.equal(formatTime(""), "—")
  assert.equal(formatTime("not a date"), "not a date")
})

test("formatTime renders a real timestamp as a local string", () => {
  const iso = "2024-03-05T10:20:30Z"
  assert.equal(formatTime(iso), new Date(iso).toLocaleString())
})
