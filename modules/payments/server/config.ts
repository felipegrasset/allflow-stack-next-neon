import {
  ProviderNotConfiguredError,
  type PaymentsEnvironment,
} from "../contracts/types"

export type Env = Record<string, string | undefined>

/**
 * `sandbox` salvo que diga `production` en `PAYMENTS_ENV`. El valor por defecto
 * es el seguro: una app recién creada, o con una variable mal escrita, no cobra
 * plata real.
 */
export function paymentsEnvironment(
  env: Env = process.env
): PaymentsEnvironment {
  return env.PAYMENTS_ENV === "production" ? "production" : "sandbox"
}

/** Las variables de un proveedor, o `null` si no está configurado (ninguna definida). Lanza si faltan solo algunas. */
export function readProviderEnv<K extends string>(
  provider: string,
  keys: readonly K[],
  env: Env = process.env
): Record<K, string> | null {
  const present = keys.filter((k) => env[k]?.trim())
  if (present.length === 0) return null
  const missing = keys.filter((k) => !env[k]?.trim())
  if (missing.length) throw new ProviderNotConfiguredError(provider, missing)
  return Object.fromEntries(keys.map((k) => [k, env[k]!.trim()])) as Record<
    K,
    string
  >
}

/** URL pública de la app, sin barra final. Los proveedores necesitan una dirección alcanzable. */
export function appBaseUrl(env: Env = process.env): string {
  const url = (env.PAYMENTS_BASE_URL || env.BETTER_AUTH_URL || "").trim()
  if (!url) {
    throw new Error(
      "Falta PAYMENTS_BASE_URL (o BETTER_AUTH_URL): los proveedores necesitan una URL pública"
    )
  }
  return url.replace(/\/+$/, "")
}

export function webhookUrl(provider: string, env: Env = process.env): string {
  return `${appBaseUrl(env)}/api/payments/webhook/${provider}`
}
