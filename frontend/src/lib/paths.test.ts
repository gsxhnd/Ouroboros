import assert from "node:assert/strict"
import { test } from "node:test"

import { isLocalPath, joinPath, parentPath, splitPath } from "./paths.ts"

test("isLocalPath accepts every local spelling the backend does", () => {
  for (const value of [
    "/data/files",
    "  /padded  ",
    "\\share\\dir",
    "~",
    "~/docs",
    "~\\docs",
    "C:\\Users\\me",
    "d:/data",
  ]) {
    assert.equal(isLocalPath(value), true, value)
  }
})

test("isLocalPath rejects remote-style paths", () => {
  for (const value of [
    "",
    "   ",
    "photos/2024",
    "gdrive:folder",
    "relative/path",
  ]) {
    assert.equal(isLocalPath(value), false, JSON.stringify(value))
  }
})

test("splitPath builds clickable breadcrumbs for POSIX paths", () => {
  assert.deepEqual(splitPath("/a/b"), [
    { name: "/", path: "/" },
    { name: "a", path: "/a" },
    { name: "b", path: "/a/b" },
  ])
})

test("splitPath builds breadcrumbs for Windows drive paths", () => {
  assert.deepEqual(splitPath("C:\\Users\\me"), [
    { name: "C:", path: "C:\\" },
    { name: "Users", path: "C:\\Users" },
    { name: "me", path: "C:\\Users\\me" },
  ])
})

test("joinPath keeps the directory's own separator", () => {
  assert.equal(joinPath("/a/b/", "c"), "/a/b/c")
  assert.equal(joinPath("C:\\a", "c"), "C:\\a\\c")
})

test("parentPath goes up one level and stops at the root", () => {
  assert.equal(parentPath("/a/b"), "/a")
  assert.equal(parentPath("/a"), "/")
  assert.equal(parentPath("/"), "/")
})
