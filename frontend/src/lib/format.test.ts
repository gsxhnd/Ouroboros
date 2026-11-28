import assert from "node:assert/strict"
import { describe, it, test } from "node:test"

import {
  formatBytes,
  formatDuration,
  formatTime,
  runDuration,
} from "./format.ts"

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

describe("formatDuration", () => {
  it("renders compact durations", () => {
    assert.equal(formatDuration(0), "0s")
    assert.equal(formatDuration(45_000), "45s")
    assert.equal(formatDuration(60_000), "1m 00s")
    assert.equal(formatDuration(192_000), "3m 12s")
    assert.equal(formatDuration(3_900_000), "1h 05m")
  })

  it("falls back to a placeholder for invalid input", () => {
    assert.equal(formatDuration(null), "—")
    assert.equal(formatDuration(Number.NaN), "—")
    assert.equal(formatDuration(-5), "—")
  })
})

describe("runDuration", () => {
  it("computes the elapsed time between start and finish", () => {
    const started = "2026-01-01T00:00:00.000Z"
    const finished = "2026-01-01T00:03:12.000Z"
    assert.equal(runDuration(started, finished), "3m 12s")
  })

  it("returns a placeholder while a run is not finished", () => {
    assert.equal(runDuration("2026-01-01T00:00:00.000Z"), "—")
    assert.equal(runDuration("", "2026-01-01T00:00:00.000Z"), "—")
  })
})
