/**
 * Phone numbers: one canonical form (E.164 with a leading +) everywhere, so
 * the opt-in, the window and the messages of a person always meet. Meta sends
 * `wa_id` without the +; this adds it.
 */

/** `+56912345678`, or null if it is not a plausible E.164 number. Idempotent. */
export function normalizePhone(input: string): string | null {
  if (typeof input !== "string") return null
  const bare = input
    .trim()
    .replace(/^whatsapp:/i, "")
    .replace(/[\s().-]/g, "")
  const digits = bare.startsWith("+") ? bare.slice(1) : bare
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null
  return `+${digits}`
}

/** Digits only, as the Cloud API wants the recipient (`56912345678`). */
export function toWaId(phone: string): string {
  return phone.replace(/^\+/, "")
}

/** `+56 ••••• 5678`: for notifications and logs. Never log the full number. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 6) return "•••"
  return `+${digits.slice(0, 2)} ••••• ${digits.slice(-4)}`
}
