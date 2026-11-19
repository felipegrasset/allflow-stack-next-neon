/**
 * The module's only log path. Allow-list: short scalars only. Never a provider
 * body, header, key, e-mail, card datum or error MESSAGE (an error's message
 * may carry provider text): of an error, only its `name` (PAY-4 of payments).
 */
export type AdminLog = {
  action: "refund" | "sync" | "return"
  outcome: string
  paymentId?: string
  actor?: string
  amountMinor?: number
  error?: string
}

const ALLOWED = [
  "action",
  "outcome",
  "paymentId",
  "actor",
  "amountMinor",
  "error",
] as const

export function adminLogLine(entry: AdminLog, at = new Date()): string {
  const clean: Record<string, string | number> = { at: at.toISOString() }
  for (const k of ALLOWED) {
    const v = entry[k]
    if (v === undefined) continue
    clean[k] = typeof v === "number" ? v : String(v).slice(0, 120)
  }
  return JSON.stringify({ scope: "payments-admin", ...clean })
}

/** `e.name` of a thrown value ("ProviderApiError"…), never its message. */
export function errorName(e: unknown): string {
  return e instanceof Error ? e.name : typeof e
}

export function logAdmin(entry: AdminLog): void {
  console.info(adminLogLine(entry))
}
