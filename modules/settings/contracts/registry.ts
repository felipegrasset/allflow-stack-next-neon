/**
 * Pure core of the settings module: definitions, the in-process registry and
 * the input/stored-value rules. No database, no request context.
 */
import { z } from "zod"

import { SettingError } from "./errors"

export type Localized = string | { es: string; en: string }

export type SettingEditor = "text" | "number" | "boolean" | "select" | "json"

export type SettingDefinition<T = unknown> = {
  readonly key: string
  readonly schema: z.ZodType<T>
  readonly default: T
  readonly label: Localized
  readonly description?: Localized
  /** Section of the admin screen. Defaults to the key prefix before the first `.`. */
  readonly group: string
  /** Allowed values, for a string setting edited with a select. */
  readonly options?: readonly string[]
  /** How the admin screen edits it. Inferred from the default value. */
  readonly editor: SettingEditor
}

export type DefineSettingInput<T> = {
  key: string
  schema: z.ZodType<T>
  default: T
  label: Localized
  description?: Localized
  group?: string
  options?: readonly string[]
}

const KEY_RE = /^[a-z][a-z0-9_.-]{0,99}$/
/** Heuristic, not a guarantee: settings are NOT a place for secrets. */
const SECRET_RE = /(secret|passw|token|api[._-]?key|private[._-]?key|credential)/i

export function isValidKey(key: string): boolean {
  return KEY_RE.test(key)
}

export function looksLikeSecretKey(key: string): boolean {
  return SECRET_RE.test(key)
}

export function localize(value: Localized, locale: string): string {
  if (typeof value === "string") return value
  return locale === "en" ? value.en : value.es
}

function inferEditor<T>(def: T, options?: readonly string[]): SettingEditor {
  if (options && options.length > 0 && typeof def === "string") return "select"
  if (typeof def === "boolean") return "boolean"
  if (typeof def === "number") return "number"
  if (typeof def === "string") return "text"
  return "json"
}

// The registry lives on globalThis so duplicated bundles of this file (Next
// compiles pages and actions separately) share one map within a process.
const REGISTRY_KEY = Symbol.for("fulvia.settings.registry")
type G = typeof globalThis & { [REGISTRY_KEY]?: Map<string, SettingDefinition> }
function registry(): Map<string, SettingDefinition> {
  const g = globalThis as G
  return (g[REGISTRY_KEY] ??= new Map())
}

/**
 * Declares a setting and registers it in this process. Throws `SettingError`
 * for a bad key, a key that looks like a secret, or a default that does not
 * pass its own schema. Defining the same key again replaces it (hot reload).
 */
export function defineSetting<T>(input: DefineSettingInput<T>): SettingDefinition<T> {
  if (!isValidKey(input.key))
    throw new SettingError("invalid_key", `Invalid setting key "${input.key}" (use [a-z][a-z0-9_.-], max 100)`)
  if (looksLikeSecretKey(input.key))
    throw new SettingError("secret_key", `"${input.key}" looks like a secret: settings must never hold secrets`)
  if (input.options && typeof input.default === "string" && !input.options.includes(input.default))
    throw new SettingError("invalid_definition", `Default of "${input.key}" is not one of its options`)
  const parsed = input.schema.safeParse(input.default)
  if (!parsed.success)
    throw new SettingError("invalid_definition", `Default of "${input.key}" does not pass its schema`)
  const def: SettingDefinition<T> = Object.freeze({
    key: input.key,
    schema: input.schema,
    default: input.default,
    label: input.label,
    description: input.description,
    group: input.group ?? (input.key.includes(".") ? input.key.split(".")[0] : "general"),
    options: input.options,
    editor: inferEditor(input.default, input.options),
  })
  registry().set(def.key, def as SettingDefinition)
  return def
}

export function findDefinition(key: string): SettingDefinition | undefined {
  return registry().get(key)
}

export function listDefinitions(): SettingDefinition[] {
  return [...registry().values()].sort((a, b) => a.key.localeCompare(b.key))
}

/** Test helper. */
export function clearRegistry(): void {
  registry().clear()
}

/** Checks `value` against the schema (and the options, if any). Throws `invalid_value`. */
export function validateValue<T>(def: SettingDefinition<T>, value: unknown): T {
  if (def.options && (typeof value !== "string" || !def.options.includes(value)))
    throw new SettingError("invalid_value", `"${def.key}" must be one of: ${def.options.join(", ")}`)
  const r = def.schema.safeParse(value)
  if (!r.success)
    throw new SettingError("invalid_value", `"${def.key}": ${r.error.issues[0]?.message ?? "invalid"}`)
  return r.data
}

export type Resolved<T> = { value: T; source: "stored" | "default" | "invalid" }

/**
 * Stored value (or undefined when there is no row) → effective value. A stored
 * value that no longer passes the schema falls back to the default and is
 * reported as `invalid` so the admin screen can show it.
 */
export function resolveValue<T>(def: SettingDefinition<T>, stored: unknown | undefined): Resolved<T> {
  if (stored === undefined) return { value: def.default, source: "default" }
  try {
    return { value: validateValue(def, stored), source: "stored" }
  } catch {
    return { value: def.default, source: "invalid" }
  }
}

/** Value → the string the admin form shows. */
export function toRaw(def: SettingDefinition, value: unknown): string {
  if (def.editor === "json") return JSON.stringify(value, null, 2) ?? ""
  return String(value ?? "")
}

/**
 * The string a form sends → a candidate value (not yet validated against the
 * schema). `ok: false` when it cannot even be read as the editor's type.
 */
export function parseRaw(
  def: SettingDefinition,
  raw: string
): { ok: true; value: unknown } | { ok: false } {
  switch (def.editor) {
    case "boolean":
      return raw === "true" ? { ok: true, value: true } : raw === "false" ? { ok: true, value: false } : { ok: false }
    case "number": {
      const t = raw.trim()
      if (t === "") return { ok: false }
      const n = Number(t)
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false }
    }
    case "json":
      try {
        return { ok: true, value: JSON.parse(raw) }
      } catch {
        return { ok: false }
      }
    default:
      return { ok: true, value: raw }
  }
}
