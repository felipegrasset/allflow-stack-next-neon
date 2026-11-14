/**
 * Pure domain constants and types of crm-lite. No server or client APIs and no
 * `@/` imports, so the tests can run them without the app's alias.
 */

/** Pipeline stages, in board order. `won` and `lost` close a deal. */
export const DEAL_STAGES = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const
export type DealStage = (typeof DEAL_STAGES)[number]

export const CLOSED_STAGES: readonly DealStage[] = ["won", "lost"]
export const isClosedStage = (s: DealStage): boolean =>
  CLOSED_STAGES.includes(s)

export function isDealStage(value: unknown): value is DealStage {
  return (
    typeof value === "string" &&
    (DEAL_STAGES as readonly string[]).includes(value)
  )
}

/** A contact is a prospect (`lead`) until a deal is won or someone marks it `customer`. */
export const CONTACT_STATUSES = ["lead", "customer"] as const
export type ContactStatus = (typeof CONTACT_STATUSES)[number]

/** Activities a person logs by hand. `stage_change` is written only by the module. */
export const MANUAL_ACTIVITY_KINDS = ["note", "call", "email", "meeting"] as const
export type ManualActivityKind = (typeof MANUAL_ACTIVITY_KINDS)[number]
export type ActivityKind = ManualActivityKind | "stage_change"

/** Currencies offered in the deal form (ISO 4217). The first one is the default. */
export const CURRENCIES = [
  "CLP",
  "USD",
  "EUR",
  "MXN",
  "ARS",
  "COP",
  "PEN",
  "BRL",
] as const
export type Currency = (typeof CURRENCIES)[number]
export const DEFAULT_CURRENCY: Currency = "CLP"

export type Contact = {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  status: ContactStatus
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export type Deal = {
  id: string
  contactId: string
  name: string
  /** Integer in the currency's minor unit (CLP: pesos; USD: cents). */
  amountMinor: number
  currency: string
  stage: DealStage
  closedAt: Date | null
  updatedAt: Date
}

/** A deal on the board: with its contact's name and company. */
export type BoardDeal = Omit<Deal, "closedAt" | "updatedAt"> & {
  contactName: string
  contactCompany: string | null
}

export type Activity = {
  id: string
  contactId: string
  dealId: string | null
  dealName: string | null
  kind: ActivityKind
  body: string | null
  fromStage: DealStage | null
  toStage: DealStage | null
  authorName: string | null
  createdAt: Date
}

/**
 * What a stage move writes, or null when nothing changes. `closed_at` is set
 * when the deal reaches won/lost and cleared when it is reopened; a won deal
 * promotes its contact to customer (never the other way around).
 */
export function planMove(
  from: DealStage,
  to: DealStage
): {
  stage: DealStage
  closeNow: boolean
  reopen: boolean
  promoteContact: boolean
} | null {
  if (from === to) return null
  return {
    stage: to,
    closeNow: isClosedStage(to),
    reopen: !isClosedStage(to),
    promoteContact: to === "won",
  }
}

/** Escapes `%`, `_` and `\` so a search term is matched literally by ILIKE. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}
