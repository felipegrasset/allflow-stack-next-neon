import type { PaymentProvider } from "../contracts/types"
import type { Env } from "../server/config"

/**
 * Mercado Pago — PENDIENTE (T6). El núcleo ya lo registra; hasta que este
 * archivo devuelva un proveedor, `getProvider("mercadopago")` responde «no
 * configurado» y su webhook responde 404. Base: ystore/lib/mercadopago.ts.
 */
export function createProvider(env: Env = process.env): PaymentProvider | null {
  void env
  return null
}
