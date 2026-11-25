import assert from "node:assert/strict"
import { test } from "node:test"

import type { RemoteOption } from "@/lib/types"

import {
  helpSummary,
  isCredential,
  matchesProvider,
  parametersFromValues,
  valuesForProvider,
  valuesFromParameters,
  visibleOptions,
} from "./model.ts"

function option(over: Partial<RemoteOption> & { name: string }): RemoteOption {
  return {
    help: "",
    type: "string",
    required: false,
    advanced: false,
    password: false,
    sensitive: false,
    exclusive: false,
    ...over,
  }
}

test("isCredential hides passwords and secret-looking sensitive fields only", () => {
  assert.equal(isCredential(option({ name: "pass", password: true })), true)
  assert.equal(
    isCredential(option({ name: "secret_access_key", sensitive: true })),
    true
  )
  assert.equal(isCredential(option({ name: "token", sensitive: true })), true)
  // rclone marks host and user as sensitive too, but they are shown in plain text.
  assert.equal(isCredential(option({ name: "host", sensitive: true })), false)
  assert.equal(isCredential(option({ name: "user", sensitive: true })), false)
  assert.equal(isCredential(option({ name: "region" })), false)
})

test("matchesProvider understands lists and negation", () => {
  assert.equal(matchesProvider(undefined, "AWS"), true)
  assert.equal(matchesProvider("  ", "AWS"), true)
  assert.equal(matchesProvider("AWS,Ceph", "AWS"), true)
  assert.equal(matchesProvider("AWS, Ceph", "Ceph"), true)
  assert.equal(matchesProvider("AWS,Ceph", "Minio"), false)
  assert.equal(matchesProvider("!AWS", "AWS"), false)
  assert.equal(matchesProvider("!AWS", "Minio"), true)
})

test("visibleOptions drops options for other providers", () => {
  const options = [
    option({ name: "a" }),
    option({ name: "b", provider: "AWS" }),
    option({ name: "c", provider: "!AWS" }),
  ]
  assert.deepEqual(
    visibleOptions(options, "AWS").map((o) => o.name),
    ["a", "b"]
  )
  assert.deepEqual(
    visibleOptions(options, "Ceph").map((o) => o.name),
    ["a", "c"]
  )
})

test("helpSummary collapses whitespace and truncates long text", () => {
  assert.equal(helpSummary("  one\n  two  "), "one two")
  const long = "x".repeat(200)
  const out = helpSummary(long)
  assert.equal(out.length, 138)
  assert.ok(out.endsWith("…"))
})

test("valuesForProvider seeds defaults, keeps previous answers and records the provider", () => {
  const options = [
    option({ name: "region", default: "us-east-1" }),
    option({ name: "versioning", type: "bool", default: "true" }),
    option({ name: "plain" }),
    option({ name: "endpoint", provider: "Minio" }),
  ]
  const fresh = valuesForProvider(options, "AWS")
  assert.deepEqual(fresh, {
    region: "us-east-1",
    versioning: true,
    provider: "AWS",
  })
  const kept = valuesForProvider(options, "AWS", { region: "eu-west-1" })
  assert.equal(kept.region, "eu-west-1")
})

test("valuesFromParameters overlays stored values and stringifies them", () => {
  const options = [
    option({ name: "port", type: "int", default: "22" }),
    option({ name: "tls", type: "bool", default: "false" }),
    option({ name: "host" }),
  ]
  const values = valuesFromParameters(options, {
    port: 2222,
    tls: "true",
    host: "",
    other: "ignored",
  })
  assert.deepEqual(values, { port: "2222", tls: true })
})

const SFTP = [
  option({ name: "host", required: true }),
  option({ name: "port", type: "int", default: "22" }),
  option({ name: "pass", password: true, required: true }),
  option({ name: "tls", type: "bool", default: "false" }),
]

test("parametersFromValues creating: submits filled fields that differ from defaults", () => {
  const result = parametersFromValues(
    SFTP,
    { host: "h.example", port: "22", pass: "pw", tls: false },
    false,
    {}
  )
  assert.deepEqual(result, {
    ok: true,
    parameters: { host: "h.example", pass: "pw" },
  })
})

test("parametersFromValues rejects a missing required field, naming it", () => {
  const result = parametersFromValues(SFTP, { host: "", pass: "pw" }, false, {})
  assert.equal(result.ok, false)
  assert.match(result.ok ? "" : result.error, /errors\.fillField.*host/)
})

test("parametersFromValues editing: a blank credential keeps the stored secret", () => {
  const result = parametersFromValues(
    SFTP,
    { host: "h.example", pass: "" },
    true,
    { host: "h.example", pass: "<hidden>" }
  )
  assert.deepEqual(result, { ok: true, parameters: {} })
})

test("parametersFromValues editing: a blank non-credential required field is still an error", () => {
  const result = parametersFromValues(SFTP, { host: "", pass: "" }, true, {
    host: "h.example",
  })
  assert.equal(result.ok, false)
})

test("parametersFromValues editing: only changed fields are sent", () => {
  const loaded = { host: "old.example", port: 22, tls: false }
  const result = parametersFromValues(
    SFTP,
    { host: "new.example", port: "22", pass: "", tls: true },
    true,
    loaded
  )
  assert.deepEqual(result, {
    ok: true,
    parameters: { host: "new.example", tls: true },
  })
})

test("parametersFromValues converts int fields and rejects non-integers", () => {
  const ok = parametersFromValues(
    SFTP,
    { host: "h", pass: "p", port: "2222" },
    false,
    {}
  )
  assert.deepEqual(ok, {
    ok: true,
    parameters: { host: "h", pass: "p", port: 2222 },
  })
  const bad = parametersFromValues(
    SFTP,
    { host: "h", pass: "p", port: "22.5" },
    false,
    {}
  )
  assert.equal(bad.ok, false)
  assert.match(bad.ok ? "" : bad.error, /errors\.integerRequired.*port/)
})

test("parametersFromValues only considers options visible for the provider", () => {
  const options = [
    option({ name: "always" }),
    option({ name: "minio_only", provider: "Minio", required: true }),
  ]
  const result = parametersFromValues(
    options,
    { provider: "AWS", always: "x" },
    false,
    {}
  )
  assert.deepEqual(result, { ok: true, parameters: { always: "x" } })
})
