import assert from "node:assert/strict"
import { test } from "node:test"

import type { ListItem } from "@/lib/types"

import {
  itemName,
  joinRemote,
  parseTransferTarget,
  remoteParent,
} from "./file-paths.ts"

const item = (over: Partial<ListItem>) => over as ListItem

test("itemName prefers name, falls back to path, then empty", () => {
  assert.equal(itemName(item({ name: "a.txt", path: "x/a.txt" })), "a.txt")
  assert.equal(itemName(item({ path: "x/a.txt" })), "x/a.txt")
  assert.equal(itemName(item({})), "")
})

test("remoteParent goes up one level and returns empty at the root", () => {
  assert.equal(remoteParent("a/b/c"), "a/b")
  assert.equal(remoteParent("a"), "")
  assert.equal(remoteParent(""), "")
})

test("joinRemote does not add a leading slash at the remote root", () => {
  assert.equal(joinRemote("", "a"), "a")
  assert.equal(joinRemote("dir", "a"), "dir/a")
  assert.equal(joinRemote("a/b", "c.txt"), "a/b/c.txt")
  assert.equal(joinRemote("", null), "")
})

test("parseTransferTarget: a local directory target keeps the whole path as fs", () => {
  assert.deepEqual(
    parseTransferTarget("/backup", { name: "a.txt", isDir: false }),
    {
      fs: "/backup",
      remote: "a.txt",
    }
  )
  assert.deepEqual(
    parseTransferTarget("/backup", { name: "photos", isDir: true }),
    {
      fs: "/backup",
      remote: undefined,
    }
  )
})

test("parseTransferTarget: a Windows or home path is local too", () => {
  assert.equal(
    parseTransferTarget("C:\\data", { name: "a", isDir: false }).fs,
    "C:\\data"
  )
  assert.equal(
    parseTransferTarget("~/docs", { name: "a", isDir: false }).fs,
    "~/docs"
  )
})

test("parseTransferTarget: the first segment of a remote target is the remote name", () => {
  assert.deepEqual(
    parseTransferTarget("gdrive", { name: "a.txt", isDir: false }),
    {
      fs: "gdrive",
      remote: "a.txt",
    }
  )
  assert.deepEqual(
    parseTransferTarget("gdrive/backups/2024", { name: "a.txt", isDir: false }),
    {
      fs: "gdrive",
      remote: "backups/2024/a.txt",
    }
  )
})

test("parseTransferTarget: a directory lands on the typed path, or the remote root when empty", () => {
  assert.deepEqual(
    parseTransferTarget("gdrive/backups", { name: "photos", isDir: true }),
    {
      fs: "gdrive",
      remote: "backups",
    }
  )
  assert.deepEqual(
    parseTransferTarget("gdrive", { name: "photos", isDir: true }),
    {
      fs: "gdrive",
      remote: undefined,
    }
  )
})
