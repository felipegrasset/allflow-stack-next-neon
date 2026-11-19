/**
 * Diff building and redaction. Pure (no imports): this is what the tests cover
 * and what guarantees that a secret never reaches the table.
 *
 * Redaction is by field NAME: any key that looks like a password, token, secret,
 * etc. (at any depth) is replaced by REDACTED. Changes are detected on the raw
 * values first, so a changed password still shows up as "changed", never its value.
 */
export const REDACTED = "[redacted]"

/** Normalized key contains one of these → sensitive. */
const SENSITIVE_PARTS = [
  "password",
  "passwd",
  "secret",
  "token",
  "apikey",
  "accesskey",
  "authorization",
  "cookie",
  "credential",
  "privatekey",
  "cardnumber",
  "sessionid",
]
/** Short names that only count as a whole key (a substring would catch "shipping"). */
const SENSITIVE_EXACT = new Set(["pin", "otp", "cvv", "cvc", "ssn", "pass", "pwd", "iban"])

const MAX_DEPTH = 6
const MAX_ITEMS = 50
const MAX_STRING = 500
/** Serialized diff above this is replaced by a short marker. */
export const MAX_DIFF_BYTES = 32_768

export type DiffEntry = { from?: unknown; to?: unknown }
export type AuditDiff = Record<string, DiffEntry>

export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/** `extra` adds field names (compared normalized, whole key) to the built-in list. */
export function isSensitiveKey(key: string, extra: readonly string[] = []): boolean {
  const n = normalizeKey(key)
  if (!n) return false
  if (SENSITIVE_EXACT.has(n)) return true
  if (SENSITIVE_PARTS.some((p) => n.includes(p))) return true
  return extra.some((e) => normalizeKey(e) === n)
}

type SanitizeOpts = { extra: readonly string[]; redact: boolean }

/** JSON-safe copy: dates → ISO, bigint → string, long strings cut, depth and size bounded. */
function sanitize(value: unknown, opts: SanitizeOpts, depth: number, seen: WeakSet<object>): unknown {
  if (value === undefined) return undefined
  if (value === null) return null
  switch (typeof value) {
    case "string":
      return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value
    case "number":
      return Number.isFinite(value) ? value : String(value)
    case "boolean":
      return value
    case "bigint":
      return value.toString()
    case "function":
    case "symbol":
      return undefined
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  const obj = value as object
  if (seen.has(obj)) return "[circular]"
  if (depth >= MAX_DEPTH) return "[max-depth]"
  seen.add(obj)
  try {
    if (Array.isArray(obj))
      return obj.slice(0, MAX_ITEMS).map((v) => sanitize(v, opts, depth + 1, seen) ?? null)
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj).slice(0, MAX_ITEMS * 4)) {
      if (v === undefined) continue
      if (opts.redact && isSensitiveKey(k, opts.extra)) {
        out[k] = REDACTED
        continue
      }
      const s = sanitize(v, opts, depth + 1, seen)
      if (s !== undefined) out[k] = s
    }
    return out
  } finally {
    seen.delete(obj)
  }
}

/** Redacts and makes any value JSON-safe. */
export function redact(value: unknown, extra: readonly string[] = []): unknown {
  return sanitize(value, { extra, redact: true }, 0, new WeakSet()) ?? null
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) return v as Record<string, unknown>
  return { value: v }
}

/**
 * Field-by-field diff. `before` missing → creation (every field has only `to`);
 * `after` missing → deletion (only `from`); both → only fields that changed.
 * Equal fields are left out. The result is already redacted.
 */
export function buildDiff(before: unknown, after: unknown, extra: readonly string[] = []): AuditDiff {
  const b = asRecord(before)
  const a = asRecord(after)
  const diff: AuditDiff = {}
  const keys = new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})])
  const raw: SanitizeOpts = { extra, redact: false }
  for (const k of keys) {
    const hasFrom = !!b && b[k] !== undefined
    const hasTo = !!a && a[k] !== undefined
    if (!hasFrom && !hasTo) continue
    if (hasFrom && hasTo) {
      const x = stable(sanitize(b![k], raw, 0, new WeakSet()))
      const y = stable(sanitize(a![k], raw, 0, new WeakSet()))
      if (x === y) continue
    }
    const entry: DiffEntry = {}
    const one = (v: unknown) =>
      isSensitiveKey(k, extra) ? REDACTED : sanitize(v, { extra, redact: true }, 0, new WeakSet()) ?? null
    if (hasFrom) entry.from = one(b![k])
    if (hasTo) entry.to = one(a![k])
    diff[k] = entry
  }
  return limitDiff(diff)
}

/** Keeps the stored diff small: too big → one marker entry naming how many fields changed. */
export function limitDiff(diff: AuditDiff): AuditDiff {
  const size = JSON.stringify(diff).length
  if (size <= MAX_DIFF_BYTES) return diff
  return { _truncated: { to: `diff too large (${Object.keys(diff).length} fields)` } }
}

/** A caller-built diff: only plain `{ field: { from?, to? } }` or `{ field: value }`, redacted. */
export function normalizeGivenDiff(given: Record<string, unknown>, extra: readonly string[] = []): AuditDiff {
  const out: AuditDiff = {}
  for (const [k, v] of Object.entries(given)) {
    if (v === undefined) continue
    if (isSensitiveKey(k, extra)) {
      out[k] = { to: REDACTED }
      continue
    }
    const isEntry =
      v !== null && typeof v === "object" && !Array.isArray(v) && ("from" in v || "to" in v)
    if (isEntry) {
      const e = v as DiffEntry
      const entry: DiffEntry = {}
      if (e.from !== undefined) entry.from = redact(e.from, extra)
      if (e.to !== undefined) entry.to = redact(e.to, extra)
      out[k] = entry
    } else out[k] = { to: redact(v, extra) }
  }
  return limitDiff(out)
}

export type DiffRow = { field: string; hasFrom: boolean; from: unknown; hasTo: boolean; to: unknown }

/** Reads a stored diff back (tolerant: anything odd gives fewer rows, never an error). */
export function parseDiff(raw: unknown): DiffRow[] {
  let v = raw
  if (typeof v === "string") {
    try {
      v = JSON.parse(v)
    } catch {
      return []
    }
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return []
  return Object.entries(v as Record<string, unknown>).map(([field, e]) => {
    const o = e && typeof e === "object" ? (e as DiffEntry) : {}
    return { field, hasFrom: "from" in o, from: o.from, hasTo: "to" in o, to: o.to }
  })
}
