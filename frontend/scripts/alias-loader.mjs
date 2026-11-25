// Resolves the "@/" alias for `node --test`, mirroring tsconfig/vite, so unit
// tests can import source modules without a bundler or a test framework.
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const srcDir = path.resolve(import.meta.dirname, "..", "src")
const i18nStub = path.resolve(import.meta.dirname, "i18n-stub.ts")
const suffixes = [".ts", ".tsx", `${path.sep}index.ts`, `${path.sep}index.tsx`]

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/i18n") {
    return nextResolve(pathToFileURL(i18nStub).href, context)
  }
  if (specifier.startsWith("@/")) {
    const base = path.join(srcDir, specifier.slice(2))
    for (const suffix of suffixes) {
      if (fs.existsSync(base + suffix)) {
        return nextResolve(pathToFileURL(base + suffix).href, context)
      }
    }
  }
  return nextResolve(specifier, context)
}
