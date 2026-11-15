/**
 * Which provider sends, from the environment. Nothing is chosen by default:
 * without WHATSAPP_PROVIDER no message leaves the app (sends answer
 * `not_configured`). `memory` is refused in production, so a deployed app
 * never "sends" into a Map by mistake.
 */
import type { WhatsAppProvider } from "../contracts/types"
import { fulviaProvider } from "./providers/fulvia"
import { memoryProvider } from "./providers/memory"
import { metaProvider } from "./providers/meta"

export type Env = Record<string, string | undefined>

export type ProviderName = "meta" | "fulvia" | "memory"

export type WhatsAppConfig = {
  /** null: WHATSAPP_PROVIDER missing or unknown. */
  provider: ProviderName | null
  /** Names (never values) of the variables still missing. */
  missing: string[]
  /** The secret that signs the inbound webhook, if any. */
  webhookSecret: string | null
  /** Meta's verify token for the GET handshake (meta only). */
  verifyToken: string | null
  /** Inbound changes for another phone number id are ignored (meta only). */
  phoneNumberId: string | null
}

const REQUIRED: Record<ProviderName, string[]> = {
  meta: [
    "WHATSAPP_META_TOKEN",
    "WHATSAPP_META_PHONE_NUMBER_ID",
    "WHATSAPP_META_APP_SECRET",
    "WHATSAPP_META_VERIFY_TOKEN",
  ],
  fulvia: ["ALLFLOW_INGEST_URL", "ALLFLOW_INGEST_KEY", "WHATSAPP_FULVIA_WEBHOOK_SECRET"],
  memory: [],
}

const val = (env: Env, k: string) => env[k]?.trim() || undefined

export function readConfig(env: Env = process.env): WhatsAppConfig {
  const raw = val(env, "WHATSAPP_PROVIDER")?.toLowerCase()
  const provider: ProviderName | null =
    raw === "meta" || raw === "fulvia" || (raw === "memory" && env.NODE_ENV !== "production")
      ? raw
      : null
  if (!provider) {
    return {
      provider: null,
      missing: ["WHATSAPP_PROVIDER"],
      webhookSecret: null,
      verifyToken: null,
      phoneNumberId: null,
    }
  }
  const missing = REQUIRED[provider].filter((k) => !val(env, k))
  return {
    provider,
    missing,
    webhookSecret:
      provider === "meta"
        ? val(env, "WHATSAPP_META_APP_SECRET") ?? null
        : provider === "fulvia"
          ? val(env, "WHATSAPP_FULVIA_WEBHOOK_SECRET") ?? null
          : null,
    verifyToken: provider === "meta" ? val(env, "WHATSAPP_META_VERIFY_TOKEN") ?? null : null,
    phoneNumberId: provider === "meta" ? val(env, "WHATSAPP_META_PHONE_NUMBER_ID") ?? null : null,
  }
}

const g = globalThis as unknown as { __whatsappMemory?: WhatsAppProvider }

/** The provider to send with, or null if not configured (or half configured). */
export function providerFromEnv(env: Env = process.env): WhatsAppProvider | null {
  const cfg = readConfig(env)
  if (!cfg.provider) return null
  if (cfg.provider === "memory") {
    g.__whatsappMemory ??= memoryProvider()
    return g.__whatsappMemory
  }
  // Sending only needs the send credentials; the webhook secrets are checked
  // by the webhook itself (it fails closed without them).
  if (cfg.provider === "meta") {
    const token = val(env, "WHATSAPP_META_TOKEN")
    const phoneNumberId = val(env, "WHATSAPP_META_PHONE_NUMBER_ID")
    if (!token || !phoneNumberId) return null
    return metaProvider({ token, phoneNumberId, apiVersion: val(env, "WHATSAPP_META_API_VERSION") })
  }
  const ingestUrl = val(env, "ALLFLOW_INGEST_URL")
  const key = val(env, "ALLFLOW_INGEST_KEY")
  if (!ingestUrl || !key) return null
  return fulviaProvider({ ingestUrl, key })
}
