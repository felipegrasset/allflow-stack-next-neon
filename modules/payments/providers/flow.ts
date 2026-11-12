import type { PaymentProvider } from "../contracts/types"
import type { Env } from "../server/config"

/** Flow — PENDIENTE (T7). Ver providers/mercadopago.ts: mismo contrato, mismo registro. */
export function createProvider(env: Env = process.env): PaymentProvider | null {
  void env
  return null
}
