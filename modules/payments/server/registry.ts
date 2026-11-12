import {
  PROVIDER_IDS,
  ProviderNotConfiguredError,
  type PaymentProvider,
  type ProviderId,
} from "../contracts/types"

import type { Env } from "./config"

type ProviderModule = {
  createProvider: (env?: Env) => PaymentProvider | null
}

/** Imports literales: así el empaquetador los ve. Cada proveedor es un archivo de `providers/`. */
const loaders: Record<ProviderId, () => Promise<ProviderModule>> = {
  mercadopago: () => import("../providers/mercadopago"),
  flow: () => import("../providers/flow"),
  paddle: () => import("../providers/paddle"),
}

/**
 * Proveedores que se eligen solos cuando la app no dice cuál. Paddle NO está:
 * solo sirve para software y contenido digital propio, y en una tienda
 * (`ecommerce`) jamás debe ser el defecto. Solo se usa si se pide por nombre.
 */
const AUTO_PICK: readonly ProviderId[] = ["mercadopago", "flow"]

/** El proveedor, o `null` si no está configurado. Las llaves vienen del entorno: las de Fulvia o las del cliente (BYOK), da igual. */
export async function findProvider(
  id: string,
  env: Env = process.env
): Promise<PaymentProvider | null> {
  if (!(PROVIDER_IDS as readonly string[]).includes(id)) return null
  const mod = await loaders[id as ProviderId]()
  return mod.createProvider(env)
}

export async function getProvider(
  id: ProviderId,
  env: Env = process.env
): Promise<PaymentProvider> {
  const p = await findProvider(id, env)
  if (!p) throw new ProviderNotConfiguredError(id, ["sus variables de entorno"])
  return p
}

/** Pedido → `PAYMENTS_PROVIDER` → el primero configurado entre los locales. */
export async function resolveProvider(
  requested?: ProviderId,
  env: Env = process.env
): Promise<PaymentProvider> {
  const wanted =
    requested ?? (env.PAYMENTS_PROVIDER?.trim() as ProviderId | undefined)
  if (wanted) return getProvider(wanted, env)
  for (const id of AUTO_PICK) {
    const p = await findProvider(id, env)
    if (p) return p
  }
  throw new ProviderNotConfiguredError("payments", [
    "las variables de Mercado Pago o de Flow (o PAYMENTS_PROVIDER)",
  ])
}
