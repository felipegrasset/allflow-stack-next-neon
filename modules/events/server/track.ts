/**
 * Delivery of usage events to Fulvia's CRM ingest (POST <base>/events).
 *
 * Pure logic with injectable dependencies (`fetch`, env, timeout) so it runs in
 * tests without network. The server-side entry point (`contracts/index.ts`)
 * only wires the real ones.
 *
 * Body accepted by the ingest (allflow.biz `src/lib/crm/schemas.ts`,
 * `ingestEventSchema`, `.strict()`): `kind` (1..60), `email` or
 * `external_user_id` (at least one), `payload` (flat-ish object, <= 8192 chars
 * of JSON), `idempotency_key`, and the contact bits `name`, `phone`,
 * `company`, `source`. `org_id`, `project_id`, `stage` and `contact_id` are
 * rejected (400), so they are never sent.
 *
 * Guarantees:
 * - No ingest key or URL -> nothing is sent, nothing throws.
 * - Never throws, and gives up after `timeoutMs`: tracking must not block or
 *   break what the person is doing.
 * - Only allow-listed property keys with primitive values are sent, and keys
 *   or values that look personal are dropped unless the caller opts in.
 */

/** Same cap the ingest applies to `payload` (JSON.stringify length). */
export const MAX_PAYLOAD_CHARS = 8 * 1024
export const MAX_PROPS = 20
export const MAX_STRING_CHARS = 200
export const MAX_KEY_CHARS = 40
export const DEFAULT_TIMEOUT_MS = 3000

/** `kind` on the wire: lower case, starts with a letter, up to 60 chars. */
const EVENT_NAME = /^[a-z][a-z0-9_.:-]{0,59}$/
const PROP_KEY = /^[a-z][a-z0-9_]{0,39}$/

/** Property keys that are sent by default. Extend per call with `allow`. */
export const DEFAULT_ALLOWED_PROPS: readonly string[] = [
  "plan",
  "amount",
  "currency",
  "status",
  "source",
  "channel",
  "count",
  "value",
  "step",
  "variant",
  "entity",
  "entity_id",
  "path",
  "locale",
  "method",
  "result",
  "reason",
]

/** Keys that name personal data: dropped even when allow-listed, unless `allowPersonal`. */
const PERSONAL_KEY =
  /(^|_)(e?mail|phone|tel|telefono|fono|celular|mobile|whatsapp|name|nombre|apellido|surname|rut|dni|address|direccion|ip|password|pass|clave|token|secret|card|tarjeta|birth|nacimiento)(_|$)/

const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/
const LONG_DIGITS = /\d[\d\s().-]{7,}\d/

export type PropValue = string | number | boolean | null
export type EventProps = Record<string, unknown>

export type TrackOptions = {
  /** Extra property keys to send besides DEFAULT_ALLOWED_PROPS. */
  allow?: readonly string[]
  /** Send keys/values that look personal (email, phone, name...). Off by default. */
  allowPersonal?: boolean
  /** Same key twice for the same contact creates one event. */
  idempotencyKey?: string
  /** `source` of the contact upsert (default "app"). */
  source?: string
}

export type TrackIdentity = {
  /** The app's own user id: the default way to tie an event to a contact. */
  userId?: string
  /** Only when the caller decides to share it; never read from props. */
  email?: string
}

export type TrackEnv = {
  ALLFLOW_INGEST_URL?: string
  ALLFLOW_INGEST_KEY?: string
}

export type TrackDeps = {
  fetch: typeof fetch
  env: TrackEnv
  timeoutMs?: number
  /** Called with a short message and no secrets when delivery fails. */
  log?: (msg: string) => void
}

export type TrackResult =
  | { ok: true; outcome: "created" | "duplicate" }
  | {
      ok: false
      reason:
        | "disabled"
        | "invalid_name"
        | "no_identity"
        | "too_large"
        | "rejected"
        | "error"
    }

export type EventBody = {
  kind: string
  external_user_id?: string
  email?: string
  payload?: Record<string, PropValue>
  idempotency_key?: string
  source?: string
}

export const isValidEventName = (name: unknown): name is string =>
  typeof name === "string" && EVENT_NAME.test(name)

function looksPersonal(value: string): boolean {
  return EMAIL_LIKE.test(value) || LONG_DIGITS.test(value)
}

/**
 * Keeps allow-listed keys with primitive values. Strings are trimmed and cut
 * to MAX_STRING_CHARS; non-finite numbers, objects, arrays and functions are
 * dropped. Returns the clean payload and the names of the dropped keys (never
 * their values).
 */
export function sanitizeProps(
  props: EventProps | undefined,
  opts: Pick<TrackOptions, "allow" | "allowPersonal"> = {}
): { payload: Record<string, PropValue>; dropped: string[] } {
  const payload: Record<string, PropValue> = {}
  const dropped: string[] = []
  if (!props || typeof props !== "object") return { payload, dropped }
  const allowed = new Set<string>([...DEFAULT_ALLOWED_PROPS, ...(opts.allow ?? [])])

  for (const [key, raw] of Object.entries(props)) {
    if (raw === undefined) continue
    if (
      !PROP_KEY.test(key) ||
      !allowed.has(key) ||
      (!opts.allowPersonal && PERSONAL_KEY.test(key)) ||
      Object.keys(payload).length >= MAX_PROPS
    ) {
      dropped.push(key)
      continue
    }
    let value: PropValue
    if (raw === null || typeof raw === "boolean") value = raw
    else if (typeof raw === "number") {
      if (!Number.isFinite(raw)) {
        dropped.push(key)
        continue
      }
      value = raw
    } else if (typeof raw === "string") {
      const s = raw.trim().slice(0, MAX_STRING_CHARS)
      if (!opts.allowPersonal && looksPersonal(s)) {
        dropped.push(key)
        continue
      }
      value = s
    } else {
      dropped.push(key)
      continue
    }
    payload[key] = value
  }
  return { payload, dropped }
}

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Builds the exact body the ingest accepts, or says why not. */
export function buildEventBody(
  name: string,
  props: EventProps | undefined,
  identity: TrackIdentity,
  opts: TrackOptions = {}
):
  | { ok: true; body: EventBody; dropped: string[] }
  | { ok: false; reason: "invalid_name" | "no_identity" | "too_large" } {
  if (!isValidEventName(name)) return { ok: false, reason: "invalid_name" }

  const userId = identity.userId?.trim().slice(0, 200)
  const email = identity.email?.trim().toLowerCase()
  const validEmail = email && email.length <= 320 && SIMPLE_EMAIL.test(email) ? email : undefined
  if (!userId && !validEmail) return { ok: false, reason: "no_identity" }

  const { payload, dropped } = sanitizeProps(props, opts)
  if (JSON.stringify(payload).length > MAX_PAYLOAD_CHARS)
    return { ok: false, reason: "too_large" }

  const body: EventBody = { kind: name }
  if (userId) body.external_user_id = userId
  if (validEmail) body.email = validEmail
  if (Object.keys(payload).length > 0) body.payload = payload
  const key = opts.idempotencyKey?.trim().slice(0, 200)
  if (key) body.idempotency_key = key
  const source = opts.source?.trim().slice(0, 60)
  body.source = source || "app"
  return { ok: true, body, dropped }
}

/** Sends one event. Never throws. */
export async function sendEvent(
  name: string,
  props: EventProps | undefined,
  identity: TrackIdentity,
  opts: TrackOptions,
  deps: TrackDeps
): Promise<TrackResult> {
  const base = deps.env.ALLFLOW_INGEST_URL?.trim().replace(/\/+$/, "")
  const key = deps.env.ALLFLOW_INGEST_KEY?.trim()
  if (!base || !key) return { ok: false, reason: "disabled" }

  let built: ReturnType<typeof buildEventBody>
  try {
    built = buildEventBody(name, props, identity, opts)
  } catch {
    return { ok: false, reason: "error" }
  }
  if (!built.ok) return built

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const res = await deps.fetch(`${base}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(built.body),
      signal: controller.signal,
    })
    if (!res.ok) {
      deps.log?.(`events: ingest answered ${res.status}`)
      return { ok: false, reason: "rejected" }
    }
    let outcome: "created" | "duplicate" = "created"
    try {
      const json = (await res.json()) as { outcome?: unknown }
      if (json.outcome === "duplicate") outcome = "duplicate"
    } catch {
      // A 2xx without a readable body still counts as delivered.
    }
    return { ok: true, outcome }
  } catch {
    deps.log?.("events: ingest unreachable or timed out")
    return { ok: false, reason: "error" }
  } finally {
    clearTimeout(timer)
  }
}
