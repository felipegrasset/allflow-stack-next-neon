/**
 * Único camino de log del módulo. Lista blanca: solo estos campos, todos
 * escalares cortos. Ningún cuerpo, cabecera, llave, correo ni error de
 * proveedor pasa por aquí (PAY-4).
 */
export type PaymentLog = {
  at: string
  provider?: string
  eventId?: string
  outcome?: string
  status?: number
  paymentId?: string
}

const ALLOWED = [
  "at",
  "provider",
  "eventId",
  "outcome",
  "status",
  "paymentId",
] as const

export function paymentsLog(entry: PaymentLog): string {
  const clean: Record<string, string | number> = {}
  for (const k of ALLOWED) {
    const v = entry[k]
    if (v === undefined) continue
    clean[k] = typeof v === "number" ? v : String(v).slice(0, 120)
  }
  return JSON.stringify({ scope: "payments", ...clean })
}

export function logPayment(entry: PaymentLog): void {
  console.info(paymentsLog(entry))
}
