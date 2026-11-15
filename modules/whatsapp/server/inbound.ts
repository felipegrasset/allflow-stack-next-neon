/**
 * What Meta POSTs to the webhook, reduced to two kinds of event:
 *
 *   { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages",
 *     value: { metadata: { phone_number_id }, messages: [...], statuses: [...] } }] }] }
 *
 * - `messages[]`: what a person wrote (`from`, `id` = wamid, `timestamp`, `type`, `text.body`).
 * - `statuses[]`: receipts of OUR messages (`id` = wamid, `status`, `errors[0].code`).
 *
 * Parsing never throws on an unknown shape: what it does not understand is
 * skipped. Nothing here logs.
 */
import { MAX_TEXT_LENGTH } from "../contracts/types"
import { applyKeyword } from "./consent"
import { detectKeyword } from "./keywords"
import { normalizePhone } from "./phone"
import type { WhatsAppStore } from "./store"

export type InboundEvent =
  | {
      type: "message"
      providerMessageId: string
      phone: string
      at: Date
      /** Text of a `text` message; null for media, location, reactions… */
      text: string | null
      phoneNumberId: string | null
    }
  | {
      type: "status"
      providerMessageId: string
      status: "sent" | "delivered" | "read" | "failed"
      errorCode: string | null
      phoneNumberId: string | null
    }

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null)

/** Unix seconds → Date, never in the future (a window must not open early or stay open longer). */
export function eventTime(ts: unknown, now: Date): Date {
  const n = Number(ts)
  if (!Number.isFinite(n) || n <= 0) return now
  const d = new Date(n * 1000)
  return d.getTime() > now.getTime() ? now : d
}

export function parseWebhookPayload(payload: unknown, now: Date = new Date()): InboundEvent[] {
  const out: InboundEvent[] = []
  if (!isObj(payload)) return out
  for (const entry of arr(payload.entry)) {
    if (!isObj(entry)) continue
    for (const change of arr(entry.changes)) {
      if (!isObj(change) || change.field !== "messages" || !isObj(change.value)) continue
      const value = change.value
      const phoneNumberId = isObj(value.metadata) ? str(value.metadata.phone_number_id) : null

      for (const m of arr(value.messages)) {
        if (!isObj(m)) continue
        const id = str(m.id)
        const phone = normalizePhone(str(m.from) ?? "")
        if (!id || !phone) continue
        const body = m.type === "text" && isObj(m.text) ? str(m.text.body) : null
        out.push({
          type: "message",
          providerMessageId: id,
          phone,
          at: eventTime(m.timestamp, now),
          text: body ? body.slice(0, MAX_TEXT_LENGTH) : null,
          phoneNumberId,
        })
      }

      for (const s of arr(value.statuses)) {
        if (!isObj(s)) continue
        const id = str(s.id)
        const status = s.status
        if (!id) continue
        if (status !== "sent" && status !== "delivered" && status !== "read" && status !== "failed")
          continue
        const err = arr(s.errors)[0]
        const code = isObj(err) && (typeof err.code === "number" || typeof err.code === "string")
          ? String(err.code)
          : null
        out.push({
          type: "status",
          providerMessageId: id,
          status,
          errorCode: status === "failed" ? code ?? "failed" : null,
          phoneNumberId,
        })
      }
    }
  }
  return out
}

export type ApplyDeps = {
  store: WhatsAppStore
  /** The provider name the rows were written with (`meta`, `fulvia`). */
  provider: string
  /** Only events for this phone number id are applied (null: no filter). */
  phoneNumberId: string | null
  /** Called once per outbound message that just became `failed` and has a `sentBy`. */
  onFailed?: (m: { messageId: string; sentBy: string; phone: string }) => Promise<void>
  now?: () => Date
  newId?: () => string
}

export type ApplySummary = {
  received: number
  duplicates: number
  optIns: number
  optOuts: number
  receipts: number
  ignored: number
}

/** Applies the events. Idempotent: a delivery repeated by Meta changes nothing. */
export async function applyEvents(deps: ApplyDeps, events: InboundEvent[]): Promise<ApplySummary> {
  const now = deps.now ?? (() => new Date())
  const newId = deps.newId ?? (() => crypto.randomUUID())
  const sum: ApplySummary = { received: 0, duplicates: 0, optIns: 0, optOuts: 0, receipts: 0, ignored: 0 }

  for (const e of events) {
    if (deps.phoneNumberId && e.phoneNumberId && e.phoneNumberId !== deps.phoneNumberId) {
      sum.ignored += 1
      continue
    }
    if (e.type === "message") {
      const kw = detectKeyword(e.text)
      // An opt-out is written BEFORE the row: if anything fails after it, Meta
      // retries and the opt-out is already in (writing it twice is harmless).
      // An opt-in goes AFTER, only on the first delivery: if it is lost, the
      // safe side (no consent) is what remains.
      if (kw === "opt_out") await applyKeyword(deps.store, e.phone, "opt_out", now())
      const inserted = await deps.store.insertMessage({
        id: newId(),
        direction: "inbound",
        phone: e.phone,
        kind: e.text !== null ? "text" : "other",
        templateName: null,
        templateLang: null,
        body: e.text,
        status: "received",
        provider: deps.provider,
        providerMessageId: e.providerMessageId,
        errorCode: null,
        idempotencyKey: null,
        userId: null,
        sentBy: null,
        createdAt: e.at,
      })
      if (!inserted) {
        sum.duplicates += 1
        continue
      }
      sum.received += 1
      if (kw === "opt_out") sum.optOuts += 1
      if (kw === "opt_in") {
        await applyKeyword(deps.store, e.phone, "opt_in", now())
        sum.optIns += 1
      }
      continue
    }
    const changed = await deps.store.applyReceipt(
      deps.provider,
      e.providerMessageId,
      e.status,
      e.errorCode
    )
    if (!changed) continue
    sum.receipts += 1
    if (e.status === "failed" && changed.sentBy && deps.onFailed) {
      await deps.onFailed({ messageId: changed.id, sentBy: changed.sentBy, phone: changed.phone })
    }
  }
  return sum
}
