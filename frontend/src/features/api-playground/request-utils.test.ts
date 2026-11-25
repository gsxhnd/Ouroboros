import { test } from "node:test"
import assert from "node:assert/strict"
import {
  replaceJsonNumber,
  captureRevision,
  formatResponseBody,
} from "./request-utils.ts"
test("replaceJsonNumber", () => {
  assert.equal(
    replaceJsonNumber('{"revision": 0, "a": 1}', "revision", 7),
    '{"revision": 7, "a": 1}'
  )
  assert.equal(replaceJsonNumber('{"a": 1}', "revision", 7), '{"a": 1}')
})
test("captureRevision", () => {
  assert.equal(captureRevision({ revision: 3 }), 3)
  assert.equal(captureRevision({ revision: "3" }), undefined)
  assert.equal(captureRevision(null), undefined)
})
test("formatResponseBody", () => {
  const base = {
    ok: true,
    status: 200,
    statusText: "",
    ms: 1,
    contentType: "",
    bodyText: "raw",
    json: null,
  }
  assert.equal(formatResponseBody(base), "raw")
  assert.equal(
    formatResponseBody({ ...base, json: { a: 1 } }),
    '{\n  "a": 1\n}'
  )
})
