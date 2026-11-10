/**
 * `pnpm modules:sync | modules:check | modules:guard` — the module contract's CLI (T1).
 *
 *   sync    validates modules/<id>/manifest.json, then (re)writes the generated
 *           registries (modules/_generated/*) and the route shims under app/.
 *           Run it after copying a module in or taking one out.
 *   check   same validation, writes nothing, exits 1 if anything is invalid or
 *           the generated files are stale. CI runs it.
 *   guard   exits 1 if the branch changed a protected zone or (when it adds a
 *           module) a genesis anchor. `--base <ref>` (default origin/main).
 *           ALLOW_PROTECTED_ZONES=1 lifts the protected-zone rule (CI sets it
 *           for a PR labelled `zonas-protegidas-ok`).
 *
 * Folders under modules/ that start with `_` (_template, _examples,
 * _generated) and `contract` are not installed modules.
 */
import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative } from "node:path"

import { buildRegistryFiles, SHIM_MARKER } from "../modules/contract/generate"
import { findViolations } from "../modules/contract/zones"
import {
  parseManifest,
  validateModules,
  type ModuleIssue,
  type ModuleSource,
} from "../modules/contract/validate"

const ROOT = process.cwd()
const MODULES_DIR = "modules"

export function listInstalledDirs(root: string): string[] {
  const dir = join(root, MODULES_DIR)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(
      (n) =>
        !n.startsWith("_") &&
        n !== "contract" &&
        statSync(join(dir, n)).isDirectory()
    )
    .sort()
}

function readTree(
  abs: string,
  base = abs,
  acc = new Map<string, string>()
): Map<string, string> {
  for (const name of readdirSync(abs)) {
    const p = join(abs, name)
    if (statSync(p).isDirectory()) readTree(p, base, acc)
    else
      acc.set(relative(base, p).split("\\").join("/"), readFileSync(p, "utf8"))
  }
  return acc
}

/** Reads every installed module of `root` (the repo, or a temp copy in tests). */
export function readModules(
  root: string,
  dirs = listInstalledDirs(root),
  modulesDir = MODULES_DIR
): ModuleSource[] {
  return dirs.map((dir) => {
    const abs = join(root, modulesDir, dir)
    const files = readTree(abs)
    let manifest: unknown = undefined
    try {
      manifest = JSON.parse(files.get("manifest.json") ?? "")
    } catch {
      manifest = undefined
    }
    return { dir, manifest, files }
  })
}

/** Validation + generation for `root`. Pure of side effects: returns what sync would write. */
export function plan(root: string): {
  issues: ModuleIssue[]
  files: Map<string, string>
} {
  const sources = readModules(root)
  const issues = validateModules(sources)
  const manifests = sources.flatMap((s) => {
    const sink: ModuleIssue[] = []
    const m = parseManifest(s.dir, s.manifest, sink)
    return m ? [{ manifest: m }] : []
  })
  return {
    issues,
    files: issues.length ? new Map() : buildRegistryFiles(manifests),
  }
}

function existingShims(root: string): string[] {
  const out: string[] = []
  const walk = (abs: string) => {
    for (const name of readdirSync(abs)) {
      const p = join(abs, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (
        name === "page.tsx" &&
        readFileSync(p, "utf8").startsWith(SHIM_MARKER)
      ) {
        out.push(relative(root, p).split("\\").join("/"))
      }
    }
  }
  if (existsSync(join(root, "app"))) walk(join(root, "app"))
  return out
}

function printIssues(issues: ModuleIssue[]) {
  for (const i of issues)
    console.error(`  ✗ [${i.module}] ${i.code}: ${i.message}`)
}

export function sync(root: string, write: boolean): number {
  const { issues, files } = plan(root)
  if (issues.length) {
    console.error(`[modules] ${issues.length} problema(s) en los manifiestos:`)
    printIssues(issues)
    return 1
  }
  const stale: string[] = []
  for (const [path, text] of files) {
    const abs = join(root, path)
    if (!existsSync(abs) || readFileSync(abs, "utf8") !== text) stale.push(path)
    if (write && stale.includes(path)) {
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, text)
    }
  }
  // Shims of routes that no longer exist.
  for (const shim of existingShims(root)) {
    if (!files.has(shim)) {
      stale.push(`${shim} (sobra)`)
      if (write) {
        rmSync(join(root, shim))
        // Leave no empty route folders behind.
        for (
          let d = dirname(join(root, shim));
          d !== join(root, "app") && readdirSync(d).length === 0;
          d = dirname(d)
        )
          rmSync(d, { recursive: true })
      }
    }
  }
  if (write) {
    console.log(
      stale.length
        ? `[modules] sync: escribió ${stale.length} archivo(s)`
        : "[modules] sync: nada que cambiar"
    )
    return 0
  }
  if (stale.length) {
    console.error(
      "[modules] los archivos generados están desactualizados; corre `pnpm modules:sync`:"
    )
    for (const s of stale) console.error(`  ✗ ${s}`)
    return 1
  }
  console.log(
    `[modules] ok: ${listInstalledDirs(root).length} módulo(s) instalado(s), registros al día`
  )
  return 0
}

export function changedFiles(base: string): string[] {
  // Three dots: only what this branch changed since it left `base`, plus uncommitted work.
  const run = (args: string[]) =>
    execFileSync("git", args, { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
  const committed = run(["diff", "--name-only", `${base}...HEAD`])
  const worktree = run(["diff", "--name-only", "HEAD"])
  const untracked = run(["ls-files", "--others", "--exclude-standard"])
  return [...new Set([...committed, ...worktree, ...untracked])]
}

function guard(args: string[]): number {
  const i = args.indexOf("--base")
  const base = i >= 0 ? args[i + 1] : "origin/main"
  let files: string[]
  try {
    files = changedFiles(base)
  } catch (e) {
    console.error(
      `[modules:guard] no pude comparar con ${base} (¿falta \`git fetch\` o fetch-depth: 0?): ${(e as Error).message}`
    )
    return 1
  }
  const violations = findViolations(files, {
    allowProtectedZones: process.env.ALLOW_PROTECTED_ZONES === "1",
  })
  if (!violations.length) {
    console.log(
      `[modules:guard] ok: ${files.length} archivo(s) cambiado(s) respecto de ${base}, sin violaciones`
    )
    return 0
  }
  console.error(`[modules:guard] ${violations.length} violación(es):`)
  for (const v of violations) console.error(`  ✗ ${v.message}`)
  return 1
}

const entry = process.argv[1] ?? ""
if (
  import.meta.url === `file://${entry}` ||
  entry.endsWith("scripts/modules.ts")
) {
  const [cmd, ...rest] = process.argv.slice(2)
  if (cmd === "sync") process.exitCode = sync(ROOT, true)
  else if (cmd === "check") process.exitCode = sync(ROOT, false)
  else if (cmd === "guard") process.exitCode = guard(rest)
  else {
    console.error(
      "uso: tsx scripts/modules.ts <sync|check|guard [--base <ref>]>"
    )
    process.exitCode = 2
  }
}
