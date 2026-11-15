/**
 * Consent rules, in one place:
 *
 * 1. No row, no consent: nothing is sent to a number without an opt-in.
 * 2. The opt-out always wins. It is always recorded, from any source.
 * 3. Once a person opted out, only THEY can come back, by writing an opt-in
 *    keyword (ALTA, START) from that number. A form, an import or an admin
 *    cannot overwrite an opt-out (none of them proves who holds the phone).
 * 4. An opt-out never creates an opt-in, and an inbound message is not
 *    consent by itself.
 */
import { z } from "zod"

import type { ConsentStatus } from "../contracts/types"
import { normalizePhone } from "./phone"
import type { WhatsAppStore } from "./store"

export const optInInputSchema = z.object({
  phone: z.string().min(1).max(40),
  /** `form`: a consent checkbox the person ticked; `api`: server code with its own proof. */
  source: z.enum(["form", "api"]),
  userId: z.string().min(1).max(200).optional(),
  /** What proves it (form + consent text version, batch id). Never personal data. */
  evidence: z.string().trim().min(1).max(500).optional(),
})
export type OptInInput = z.input<typeof optInInputSchema>

export const optOutInputSchema = z.object({
  phone: z.string().min(1).max(40),
  source: z.enum(["form", "api", "admin"]),
  userId: z.string().min(1).max(200).optional(),
})
export type OptOutInput = z.input<typeof optOutInputSchema>

export type ConsentResult =
  | { ok: true; phone: string; status: Exclude<ConsentStatus, "none"> }
  | { ok: false; reason: "invalid_input" | "invalid_phone" | "opted_out" }

export async function recordOptIn(
  store: WhatsAppStore,
  input: OptInInput,
  now: Date = new Date()
): Promise<ConsentResult> {
  const parsed = optInInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: "invalid_input" }
  const phone = normalizePhone(parsed.data.phone)
  if (!phone) return { ok: false, reason: "invalid_phone" }
  const current = await store.getConsent(phone)
  if (current.status === "opted_out") return { ok: false, reason: "opted_out" }
  await store.writeConsent({
    phone,
    status: "opted_in",
    source: parsed.data.source,
    userId: parsed.data.userId,
    evidence: parsed.data.evidence,
    at: now,
  })
  return { ok: true, phone, status: "opted_in" }
}

export async function recordOptOut(
  store: WhatsAppStore,
  input: OptOutInput,
  now: Date = new Date()
): Promise<ConsentResult> {
  const parsed = optOutInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: "invalid_input" }
  const phone = normalizePhone(parsed.data.phone)
  if (!phone) return { ok: false, reason: "invalid_phone" }
  await store.writeConsent({
    phone,
    status: "opted_out",
    source: parsed.data.source,
    userId: parsed.data.userId,
    at: now,
  })
  return { ok: true, phone, status: "opted_out" }
}

/** Only from the inbound webhook: the person wrote the keyword from this number. */
export async function applyKeyword(
  store: WhatsAppStore,
  phone: string,
  keyword: "opt_in" | "opt_out",
  now: Date
): Promise<void> {
  await store.writeConsent({
    phone,
    status: keyword === "opt_in" ? "opted_in" : "opted_out",
    source: "keyword",
    evidence: keyword === "opt_in" ? "inbound keyword" : null,
    at: now,
  })
}
