/**
 * Keywords a person writes to the number to leave or come back. Compared on
 * the WHOLE message (trimmed, upper case, no accents, no final punctuation):
 * "baja" opts out, "quiero darme de baja de las promos" does not (an app may
 * still read it and call recordOptOut itself).
 */
const OPT_OUT = new Set([
  "BAJA",
  "DARME DE BAJA",
  "STOP",
  "UNSUBSCRIBE",
  "DESUSCRIBIR",
  "CANCELAR SUSCRIPCION",
  "NO MAS MENSAJES",
])

const OPT_IN = new Set(["ALTA", "START", "SUSCRIBIR", "SUBSCRIBE"])

export function normalizeKeyword(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[.!¡¿?,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export type Keyword = "opt_out" | "opt_in" | null

export function detectKeyword(text: string | null | undefined): Keyword {
  if (!text) return null
  const k = normalizeKeyword(text)
  if (k.length === 0 || k.length > 40) return null
  if (OPT_OUT.has(k)) return "opt_out"
  if (OPT_IN.has(k)) return "opt_in"
  return null
}
