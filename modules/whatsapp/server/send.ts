/**
 * Sending, with every rule checked BEFORE the provider is called, in this
 * order (each message costs money and goes to a person's phone):
 *
 *   1. input valid (zod), phone valid
 *   2. idempotency key already used → the earlier result, nothing sent
 *   3. provider configured
 *   4. consent: opted out → blocked (the opt-out wins); no opt-in → blocked
 *   5. free text only inside the 24 h window; outside it, only templates
 *   6. the row is inserted (`pending`) — with a key, the insert is the lock
 *   7. the provider is called; the row ends `sent` or `failed`
 *
 * Blocked attempts are stored as `blocked` rows WITHOUT body (an audit of
 * what the app tried, without keeping text for someone who did not consent).
 * Nothing here logs a body or a full phone number.
 */
import { z } from "zod"

import {
  MAX_TEXT_LENGTH,
  type SendBlockReason,
  type SendInput,
  type SendResult,
  type WhatsAppMessage,
  type WhatsAppProvider,
} from "../contracts/types"
import { normalizePhone } from "./phone"
import type { WhatsAppStore } from "./store"
import { withinServiceWindow } from "./window"

export const templateSchema = z.object({
  name: z.string().regex(/^[a-z0-9_]{1,512}$/),
  lang: z.string().regex(/^[a-z]{2,3}(_[A-Z]{2})?$/),
  params: z.array(z.string().min(1).max(1024)).max(20).optional(),
})

export const sendInputSchema = z
  .object({
    to: z.string().min(1).max(40),
    text: z.string().trim().min(1).max(MAX_TEXT_LENGTH).optional(),
    template: templateSchema.optional(),
    userId: z.string().min(1).max(200).optional(),
    sentBy: z.string().min(1).max(200).optional(),
    idempotencyKey: z.string().min(1).max(200).optional(),
  })
  // Internal invariant (never shown to a person): the plain-string form of refine.
  .refine((v) => (v.text === undefined) !== (v.template === undefined), "text xor template")

export type SendDeps = {
  store: WhatsAppStore
  /** null = not configured. */
  provider: () => WhatsAppProvider | null
  now?: () => Date
  newId?: () => string
  /** Never receives a body or a full phone number. */
  log?: (msg: string, meta?: Record<string, unknown>) => void
}

function resultOf(m: WhatsAppMessage): SendResult {
  if (m.status === "blocked")
    return { ok: false, reason: (m.errorCode as SendBlockReason) ?? "invalid_input", messageId: m.id }
  if (m.status === "failed")
    return {
      ok: false,
      reason: "provider_error",
      messageId: m.id,
      errorCode: m.errorCode ?? "failed",
      deduped: true,
    }
  return {
    ok: true,
    messageId: m.id,
    providerMessageId: m.providerMessageId ?? "",
    deduped: true,
  }
}

export async function sendWhatsApp(deps: SendDeps, input: SendInput): Promise<SendResult> {
  const now = deps.now ?? (() => new Date())
  const newId = deps.newId ?? (() => crypto.randomUUID())

  const parsed = sendInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: "invalid_input" }
  const v = parsed.data
  const phone = normalizePhone(v.to)
  if (!phone) return { ok: false, reason: "invalid_phone" }

  if (v.idempotencyKey) {
    const earlier = await deps.store.findByIdempotencyKey(v.idempotencyKey)
    if (earlier) return resultOf(earlier)
  }

  const provider = deps.provider()
  if (!provider) return { ok: false, reason: "not_configured" }

  const kind: "template" | "text" = v.template ? "template" : "text"
  const base = {
    direction: "outbound" as const,
    phone,
    kind,
    templateName: v.template?.name ?? null,
    templateLang: v.template?.lang ?? null,
    provider: provider.name,
    providerMessageId: null,
    userId: v.userId ?? null,
    sentBy: v.sentBy ?? null,
  }

  const block = async (reason: SendBlockReason): Promise<SendResult> => {
    const id = newId()
    await deps.store.insertMessage({
      ...base,
      id,
      body: null,
      status: "blocked",
      errorCode: reason,
      // No key on a blocked row: once the person opts in, the same key may send.
      idempotencyKey: null,
    })
    deps.log?.("whatsapp: send blocked", { reason, kind })
    return { ok: false, reason, messageId: id }
  }

  const consent = await deps.store.getConsent(phone)
  if (consent.status === "opted_out") return block("opted_out")
  if (consent.status !== "opted_in") return block("no_optin")

  if (kind === "text") {
    const last = await deps.store.lastInboundAt(phone)
    if (!withinServiceWindow(last, now())) return block("outside_window")
  }

  const id = newId()
  const inserted = await deps.store.insertMessage({
    ...base,
    id,
    body: v.text ?? null,
    status: "pending",
    errorCode: null,
    idempotencyKey: v.idempotencyKey ?? null,
  })
  if (!inserted) {
    // Another call with the same key won the insert a moment ago.
    const earlier = v.idempotencyKey
      ? await deps.store.findByIdempotencyKey(v.idempotencyKey)
      : null
    if (earlier) return resultOf(earlier)
    throw new Error("whatsapp: could not record the message")
  }

  let res
  try {
    res = v.template
      ? await provider.sendTemplate(phone, v.template)
      : await provider.sendText(phone, v.text!)
  } catch {
    res = { ok: false as const, errorCode: "provider_exception" }
  }

  if (res.ok) {
    await deps.store.updateMessage(id, {
      status: "sent",
      providerMessageId: res.providerMessageId,
      errorCode: null,
    })
    return { ok: true, messageId: id, providerMessageId: res.providerMessageId, deduped: false }
  }
  const errorCode = res.outsideWindow ? "outside_window" : res.errorCode
  await deps.store.updateMessage(id, { status: "failed", errorCode })
  deps.log?.("whatsapp: provider refused", { provider: provider.name, errorCode, kind })
  return res.outsideWindow
    ? { ok: false, reason: "outside_window", messageId: id }
    : { ok: false, reason: "provider_error", messageId: id, errorCode }
}
