import assert from "node:assert/strict"
import { test } from "node:test"

import type { JobLocator, SyncTask, TaskEndpoint } from "@/lib/types"

import {
  bisyncNeedsResync,
  endpointLabel,
  locatorLabel,
  operationLabel,
  scheduleLabel,
} from "./labels.ts"

const t = (key: string) => key

test("endpointLabel shows remote endpoints as name:path and local ones as the path", () => {
  assert.equal(
    endpointLabel({
      kind: "remote",
      remote: "gdrive",
      path: "a/b",
    } as TaskEndpoint),
    "gdrive:a/b"
  )
  assert.equal(
    endpointLabel({ kind: "remote", remote: "gdrive" } as TaskEndpoint),
    "gdrive:"
  )
  assert.equal(
    endpointLabel({ kind: "local", path: "/data" } as TaskEndpoint),
    "/data"
  )
  assert.equal(endpointLabel({ kind: "local" } as TaskEndpoint), "")
})

test("operationLabel maps each operation, and an unknown one to the mirror-sync label", () => {
  assert.equal(operationLabel({ operation: "copy" }, t), "sync.opCopy")
  assert.equal(operationLabel({ operation: "move" }, t), "sync.opMove")
  assert.equal(operationLabel({ operation: "bisync" }, t), "sync.opBisync")
  assert.equal(operationLabel({ operation: "sync" }, t), "sync.opSync")
  assert.equal(operationLabel({ operation: "something-new" }, t), "sync.opSync")
})

test("scheduleLabel distinguishes manual, cron and presets", () => {
  const at = (schedule: unknown) =>
    scheduleLabel({ schedule } as Pick<SyncTask, "schedule">, t)
  assert.equal(at(undefined), "sync.scheduleManual")
  assert.equal(
    at({ enabled: false, mode: "preset", preset: "daily" }),
    "sync.scheduleManual"
  )
  assert.equal(
    at({ enabled: true, mode: "cron", cron: "0 3 * * *" }),
    "sync.scheduleCron · 0 3 * * *"
  )
  assert.equal(
    at({ enabled: true, mode: "preset", preset: "hourly" }),
    "sync.scheduleHourly"
  )
  assert.equal(
    at({ enabled: true, mode: "preset", preset: "weekly" }),
    "sync.scheduleWeekly"
  )
  assert.equal(
    at({ enabled: true, mode: "preset", preset: "daily" }),
    "sync.scheduleDaily"
  )
})

test("bisyncNeedsResync is true only for a two-way task that has not succeeded yet", () => {
  const need = (operation: string, status?: string) =>
    bisyncNeedsResync({
      operation,
      last_result: status ? { status } : null,
    } as Pick<SyncTask, "operation" | "last_result">)
  assert.equal(need("bisync"), true)
  assert.equal(need("bisync", "failed"), true)
  assert.equal(need("bisync", "succeeded"), false)
  assert.equal(need("sync"), false)
  assert.equal(need("copy", "failed"), false)
})

test("locatorLabel mirrors the backend's Locator.Display()", () => {
  const label = (locator: Partial<JobLocator>) =>
    locatorLabel(locator as JobLocator)
  assert.equal(
    label({ kind: "remote", fs: "gdrive:", remote: "a/b" }),
    "gdrive:a/b"
  )
  assert.equal(label({ kind: "remote", fs: "gdrive", remote: "a" }), "gdrive:a")
  assert.equal(label({ kind: "local", fs: "/data", remote: "x" }), "/data/x")
  assert.equal(label({ kind: "local", fs: "/data", remote: "" }), "/data")
})
