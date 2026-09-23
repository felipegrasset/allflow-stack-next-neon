/**
 * The sentinel contract with AllFlow's Forge (P4). Runs in CI on every push:
 * `pnpm test:sentinels`.
 *
 * Uses Forge's own parseSentinelConfig() and render() sentinel passes
 * (vendored in ./forge-contract.ts) instead of re-implementing the check, over
 * every file git would ship — so a sentinel copied into a new file, a stale
 * whitelist entry, or a broken allflow.sentinels.json fails here and not in a
 * client's generation.
 *
 * This file must not contain the sentinel literals itself (it would be
 * "outside the whitelist"); it reads them from allflow.sentinels.json.
 */
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  fillValue,
  parseSentinelConfig,
  renderSentinels,
  SENTINELS_FILE,
  type ForgeAnswers,
  type SentinelConfig,
} from "./forge-contract"

const ROOT = join(import.meta.dirname, "..")

/** The template's own defaults, i.e. what each literal must render back to. */
const DEFAULTS: Partial<ForgeAnswers> = { brandH: 195, brandC: 0.12 }

const SAMPLE: ForgeAnswers = {
  appName: "ferreteria-sur",
  appTitle: "Ferretería Sur",
  domain: "ferreteriasur.cl",
  brandH: 28,
  brandC: 0.17,
  db: "neon-postgres",
}

function loadConfig(): SentinelConfig {
  const parsed = parseSentinelConfig(readFileSync(join(ROOT, SENTINELS_FILE), "utf8"))
  if (!parsed.ok) assert.fail(parsed.issues.map((i) => i.message).join("\n"))
  return parsed.config
}

/** Every text file git would ship: tracked + untracked-but-not-ignored. */
function repoTextFiles(): Map<string, string> {
  const paths = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean)
  const files = new Map<string, string>()
  for (const p of paths) {
    const abs = join(ROOT, p)
    if (!existsSync(abs)) continue // deleted in the working tree
    const buf = readFileSync(abs)
    if (buf.includes(0)) continue // binary (favicon, fonts)
    files.set(p, buf.toString("utf8"))
  }
  return files
}

test("allflow.sentinels.json parses with Forge's parser", () => {
  loadConfig()
})

test("declares the five sentinels Forge needs, one per answer", () => {
  const cfg = loadConfig()
  const keys = cfg.sentinels.flatMap((s) => [...s.value.matchAll(/\{\{\s*([A-Za-z]+)\s*\}\}/g)].map((m) => m[1]))
  assert.deepEqual([...keys].sort(), ["appName", "appTitle", "brandC", "brandH", "domain"])
})

test("brand sentinels are the literal CSS declarations with the template defaults", () => {
  for (const s of loadConfig().sentinels) {
    if (!/brandH|brandC/.test(s.value)) continue
    assert.equal(fillValue(s.value, DEFAULTS as ForgeAnswers), s.literal, `${s.literal} ≠ su value con los defaults`)
    assert.match(s.literal, /^--brand-[hc]: [0-9.]+;$/)
  }
})

test("every whitelisted file exists and still contains its literal", () => {
  const files = repoTextFiles()
  for (const s of loadConfig().sentinels) {
    for (const f of s.files) {
      assert.ok(files.has(f), `${f} (lista blanca de "${s.literal}") no existe o no está en git`)
      assert.ok(files.get(f)!.includes(s.literal), `${f} ya no contiene "${s.literal}": saca el archivo de la lista blanca`)
    }
  }
})

test("Forge's render() over the whole repo: no sentinel outside its whitelist, none left over", () => {
  const cfg = loadConfig()
  const res = renderSentinels(repoTextFiles(), cfg, SAMPLE)
  if (!res.ok) assert.fail(res.issues.map((i) => `${i.code}: ${i.message}`).join("\n"))

  const css = res.files.get("app/globals.css")!
  assert.ok(css.includes(`--brand-h: ${SAMPLE.brandH};`))
  assert.ok(css.includes(`--brand-c: ${SAMPLE.brandC};`))
  const pkg = JSON.parse(res.files.get("package.json")!) as { name: string }
  assert.equal(pkg.name, SAMPLE.appName)
  assert.ok(res.files.get("lib/site.ts")!.includes(`"https://${SAMPLE.domain}"`))
})

test("render is deterministic", () => {
  const cfg = loadConfig()
  const files = repoTextFiles()
  const a = renderSentinels(files, cfg, SAMPLE)
  const b = renderSentinels(files, cfg, SAMPLE)
  assert.ok(a.ok && b.ok)
  assert.deepEqual([...a.files], [...b.files])
})
