/**
 * Money in crm-lite: an integer in the currency's minor unit + ISO 4217 code.
 * Pure (no `@/` imports). Same exponent rule as payments/contracts/money, but
 * copied on purpose: crm-lite does not depend on payments.
 */

/** Digits after the decimal point of a currency: CLP 0, USD 2. */
export function currencyExponent(currency: string): number {
  return (
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  )
}

export function minorToMajor(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** currencyExponent(currency)
}

/** Largest amount accepted, in minor units (well below 2^53). */
export const MAX_AMOUNT_MINOR = 1e15

/**
 * Text a person typed → integer in minor units, or null if it is not a valid,
 * non-negative amount. No floating point: the digits are joined as text.
 *
 * Separators: with a 0-exponent currency (CLP) every `.` or `,` is a thousands
 * separator ("1.500.000" → 1500000). Otherwise the LAST `.` or `,` is the
 * decimal mark when 1..exponent digits follow it ("1.234,5" USD → 123450,
 * "15.50" → 1550); any other separator is a thousands separator
 * ("1,234" USD → 123400).
 */
export function parseAmount(text: string, currency: string): number | null {
  const s = text.replace(/[\s ]/g, "")
  if (!/^\d[\d.,]*$/.test(s) || /[.,]{2}/.test(s) || /[.,]$/.test(s))
    return null
  const exp = currencyExponent(currency)
  let whole = s
  let frac = ""
  if (exp > 0) {
    const i = Math.max(s.lastIndexOf("."), s.lastIndexOf(","))
    const tail = i >= 0 ? s.slice(i + 1) : ""
    if (i >= 0 && tail.length >= 1 && tail.length <= exp) {
      whole = s.slice(0, i)
      frac = tail
    }
  }
  const digits = whole.replace(/[.,]/g, "") + frac.padEnd(exp, "0")
  const n = Number(digits)
  if (!Number.isSafeInteger(n) || n > MAX_AMOUNT_MINOR) return null
  return n
}

/** Minor units → the text the edit form shows back (no grouping: "1500000", "15.50"). */
export function formatAmountInput(amountMinor: number, currency: string): string {
  const exp = currencyExponent(currency)
  if (exp === 0) return String(amountMinor)
  const s = String(amountMinor).padStart(exp + 1, "0")
  return `${s.slice(0, -exp)}.${s.slice(-exp)}`
}
