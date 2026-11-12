import type { PaymentProvider } from "../contracts/types"
import type { Env } from "../server/config"

/**
 * Paddle — PENDIENTE (T8). Solo para apps que venden software o contenido
 * digital propio, cada cliente con su cuenta: el registro nunca lo elige por
 * defecto (server/registry.ts), solo si se pide por nombre.
 */
export function createProvider(env: Env = process.env): PaymentProvider | null {
  void env
  return null
}
