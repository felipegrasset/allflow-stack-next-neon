/**
 * settings v0.1 — what can be tested WITHOUT a database: definitions and the
 * registry, validation, stored-value resolution, form parsing, the catalog
 * (es/en parity), permissions, the manifest and, reading the code, that every
 * Server Action checks session + permission before writing.
 * Relative imports only, so it also runs transpiled without the `@/` alias.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { z } from "zod"

import { isSettingError } from "../contracts/errors"
import {
  clearRegistry,
  defineSetting,
  findDefinition,
  listDefinitions,
  localize,
  parseRaw,
  resolveValue,
  toRaw,
  validateValue,
  type SettingDefinition,
} from "../contracts/registry"
import { en, es } from "../messages"
import { permissions } from "../permissions"

const DIR = join(process.cwd(), "modules", "settings") // run from the template root
const read = (rel: string) => readFileSync(join(DIR, rel), "utf8")

function code(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (e) {
    return isSettingError(e) ? e.code : "other"
  }
  return undefined
}

test("defineSetting: registers, infers the editor and the group", () => {
  clearRegistry()
  const a = defineSetting({ key: "shop.name", schema: z.string(), default: "Tienda", label: "Nombre" })
  const b = defineSetting({ key: "shop.max", schema: z.number().int(), default: 3, label: "Máx" })
  const c = defineSetting({ key: "shop.open", schema: z.boolean(), default: true, label: "Abierta" })
  const d = defineSetting({ key: "shop.mode", schema: z.enum(["a", "b"]), default: "a", label: "Modo", options: ["a", "b"] })
  const e = defineSetting({ key: "tags", schema: z.array(z.string()), default: ["x"], label: "Tags" })
  assert.deepEqual([a, b, c, d, e].map((s) => s.editor), ["text", "number", "boolean", "select", "json"])
  assert.equal(a.group, "shop")
  assert.equal(e.group, "general")
  assert.equal(findDefinition("shop.max"), b)
  assert.deepEqual(listDefinitions().map((s) => s.key), ["shop.max", "shop.mode", "shop.name", "shop.open", "tags"])
})

test("defineSetting: bad keys, secret-looking keys and invalid defaults are rejected", () => {
  clearRegistry()
  for (const key of ["", "Shop.Name", "1abc", "a b", "x".repeat(101)])
    assert.equal(code(() => defineSetting({ key, schema: z.string(), default: "", label: "x" })), "invalid_key", key)
  for (const key of ["payments.api_key", "mail.password", "auth.secret", "x.token"])
    assert.equal(code(() => defineSetting({ key, schema: z.string(), default: "", label: "x" })), "secret_key", key)
  assert.equal(code(() => defineSetting({ key: "n", schema: z.number().min(1), default: 0, label: "x" })), "invalid_definition")
  assert.equal(
    code(() => defineSetting({ key: "m", schema: z.string(), default: "z", label: "x", options: ["a"] })),
    "invalid_definition"
  )
  assert.equal(listDefinitions().length, 0)
})

test("defineSetting: defining a key twice replaces it", () => {
  clearRegistry()
  defineSetting({ key: "k.v", schema: z.string(), default: "a", label: "x" })
  defineSetting({ key: "k.v", schema: z.string(), default: "b", label: "x" })
  assert.equal(listDefinitions().length, 1)
  assert.equal(findDefinition("k.v")?.default, "b")
})

test("validateValue: schema and options are enforced, transforms apply", () => {
  clearRegistry()
  const n = defineSetting({ key: "p.size", schema: z.number().int().min(5).max(100), default: 20, label: "x" })
  assert.equal(validateValue(n, 50), 50)
  for (const bad of [4, 101, 1.5, "10", null]) assert.equal(code(() => validateValue(n, bad)), "invalid_value")
  const t = defineSetting({ key: "p.name", schema: z.string().trim().min(1), default: "x", label: "x" })
  assert.equal(validateValue(t, "  hola "), "hola")
  const o = defineSetting({ key: "p.mode", schema: z.string(), default: "a", label: "x", options: ["a", "b"] })
  assert.equal(code(() => validateValue(o, "c")), "invalid_value")
})

test("resolveValue: default without a row, stored when valid, default + flag when invalid", () => {
  clearRegistry()
  const n = defineSetting({ key: "r.n", schema: z.number().max(10), default: 1, label: "x" })
  assert.deepEqual(resolveValue(n, undefined), { value: 1, source: "default" })
  assert.deepEqual(resolveValue(n, 7), { value: 7, source: "stored" })
  assert.deepEqual(resolveValue(n, 99), { value: 1, source: "invalid" })
  assert.deepEqual(resolveValue(n, "texto"), { value: 1, source: "invalid" })
  const nullable = defineSetting({ key: "r.nul", schema: z.string().nullable(), default: null, label: "x" })
  assert.deepEqual(resolveValue(nullable, null), { value: null, source: "stored" })
})

test("parseRaw / toRaw: what the form sends and shows", () => {
  clearRegistry()
  const n = defineSetting({ key: "f.n", schema: z.number(), default: 1, label: "x" })
  const b = defineSetting({ key: "f.b", schema: z.boolean(), default: false, label: "x" })
  const j = defineSetting({ key: "f.j", schema: z.array(z.number()), default: [1], label: "x" })
  const s = defineSetting({ key: "f.s", schema: z.string(), default: "", label: "x" })
  assert.deepEqual(parseRaw(n, " 12.5 "), { ok: true, value: 12.5 })
  for (const bad of ["", "  ", "abc", "Infinity"]) assert.deepEqual(parseRaw(n, bad), { ok: false }, bad)
  assert.deepEqual(parseRaw(b, "true"), { ok: true, value: true })
  assert.deepEqual(parseRaw(b, "yes"), { ok: false })
  assert.deepEqual(parseRaw(j, "[1,2]"), { ok: true, value: [1, 2] })
  assert.deepEqual(parseRaw(j, "[1,"), { ok: false })
  assert.deepEqual(parseRaw(s, " tal cual "), { ok: true, value: " tal cual " })
  assert.equal(toRaw(n, 3), "3")
  assert.equal(toRaw(b, true), "true")
  assert.equal(JSON.parse(toRaw(j, [1, 2])).length, 2)
  assert.equal(toRaw(s, ""), "")
})

test("localize: string as is, es/en pairs by locale", () => {
  assert.equal(localize("Hola", "en"), "Hola")
  assert.equal(localize({ es: "Hola", en: "Hi" }, "en"), "Hi")
  assert.equal(localize({ es: "Hola", en: "Hi" }, "es"), "Hola")
  assert.equal(localize({ es: "Hola", en: "Hi" }, "fr"), "Hola")
})

test("built-in definitions are valid and have an es/en label", async () => {
  clearRegistry()
  // Imported after the clear: the module registers its settings on load.
  const defs = await import("../definitions")
  for (const d of [defs.APP_NAME, defs.SUPPORT_EMAIL, defs.DEFAULT_PAGE_SIZE]) {
    assert.equal(typeof d.label, "object")
    assert.equal(validateValue(d as SettingDefinition, d.default), d.default)
  }
  assert.equal(validateValue(defs.SUPPORT_EMAIL, "a@ejemplo.cl"), "a@ejemplo.cl")
  assert.equal(code(() => validateValue(defs.SUPPORT_EMAIL, "no-es-correo")), "invalid_value")
  assert.equal(code(() => validateValue(defs.DEFAULT_PAGE_SIZE, 1000)), "invalid_value")
})

test("catalog: same keys in es and en, and an error text per failure", () => {
  const keys = (o: object, p = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [p + k] : keys(v, `${p}${k}.`)))
  assert.deepEqual(keys(en).sort(), keys(es).sort())
  for (const k of ["forbidden", "invalid", "unknown", "generic"]) assert.ok(k in es.settings.errors, k)
})

test("permissions: setting read/write, no grant for member", () => {
  assert.deepEqual(permissions.statement, { setting: ["read", "write"] })
  assert.equal("grants" in permissions, false)
})

test("manifest: table, migration and route", () => {
  const m = JSON.parse(read("manifest.json"))
  assert.equal(m.id, "settings")
  assert.deepEqual(m.tables, ["settings"])
  assert.deepEqual(m.migrations, ["0116_settings_init"])
  assert.equal(m.routes[0].path, "/admin/settings")
  assert.match(read("db/migrations/0116_settings_init.ts"), /key\s+text\s+primary key/)
})

test("every Server Action checks session + permission before validating and writing", () => {
  const src = read("server/actions.ts")
  assert.match(src, /^"use server"/)
  const actions = [...src.matchAll(/export async function (\w+)\(/g)].map((m) => m[1])
  assert.deepEqual(actions.sort(), ["resetSettingAction", "saveSettingAction"])
  for (const name of actions) {
    const start = src.indexOf(`export async function ${name}(`)
    const next = src.indexOf("export async function", start + 1)
    const body = src.slice(start, next === -1 ? undefined : next)
    const guard = body.indexOf('await actionSession("/admin/settings", "write")')
    const write = body.search(/await (setWith|resetWith)\(/)
    assert.ok(guard > 0, `${name}: no guard`)
    assert.ok(write > guard, `${name}: writes before the guard`)
    assert.ok(body.indexOf("findDefinition(") > guard, `${name}: looks up the key before the guard`)
  }
  const save = src.slice(src.indexOf("export async function saveSettingAction("))
  assert.ok(save.indexOf("validateValue(") < save.indexOf("await setWith("))
})

test("the store writes through Kysely only (no concatenated SQL)", () => {
  const store = read("server/store.ts")
  assert.doesNotMatch(store, /sql`/)
  assert.match(store, /onConflict\(/)
  assert.match(read("contracts/registry.ts"), /secret/)
})
