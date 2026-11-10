/**
 * Entrega de un lead al CRM de Fulvia por la llave de ingesta.
 *
 * Lógica pura con dependencias inyectables (`fetch`, entorno) para probarla sin
 * red. La Server Action (`actions.ts`) solo la llama.
 *
 * - Honeypot: un bot que lo llena recibe «ok» y no se manda nada.
 * - Consentimiento: obligatorio; se guarda en `attributes` con la fecha.
 * - Turnstile: solo si hay `TURNSTILE_SECRET_KEY`; sin ella no se verifica.
 * - Sin llave de ingesta no se finge éxito: se devuelve `unavailable`.
 * - El cuerpo al CRM no lleva campos que la ingesta rechaza (`org_id`, `stage`…).
 */
import { z } from "zod"

const clip = (n: number) => z.string().trim().max(n)

export const leadInputSchema = z.object({
  name: clip(120).optional(),
  email: z.email().max(200),
  message: clip(2000).optional(),
  consent: z.literal(true),
  /** Honeypot: un humano no lo ve. */
  website: z.string().max(200).optional(),
  captchaToken: z.string().max(4096).optional(),
  utm_source: clip(160).optional(),
  utm_medium: clip(160).optional(),
  utm_campaign: clip(160).optional(),
  landing: clip(160).optional(),
})
export type LeadInput = z.infer<typeof leadInputSchema>

export type LeadResult =
  | { ok: true }
  | {
      ok: false
      reason: "invalid" | "consent" | "captcha" | "unavailable" | "upstream"
    }

export type LeadEnv = {
  ALLFLOW_INGEST_URL?: string
  ALLFLOW_INGEST_KEY?: string
  TURNSTILE_SECRET_KEY?: string
}
export type LeadDeps = {
  fetch: typeof fetch
  env: LeadEnv
  now: () => Date
  remoteIp?: string
}

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

export async function verifyTurnstile(
  token: string | undefined,
  deps: Pick<LeadDeps, "fetch" | "env" | "remoteIp">
): Promise<boolean> {
  const secret = deps.env.TURNSTILE_SECRET_KEY
  if (!secret) return true // sin clave no hay verificación (solo honeypot)
  if (!token) return false
  const body = new URLSearchParams({ secret, response: token })
  if (deps.remoteIp) body.set("remoteip", deps.remoteIp)
  try {
    const res = await deps.fetch(VERIFY_URL, { method: "POST", body })
    const data = (await res.json()) as { success?: boolean }
    return Boolean(data.success)
  } catch {
    return false // cierra en falso: sin respuesta de Cloudflare no pasa
  }
}

export async function submitLead(
  raw: unknown,
  deps: LeadDeps
): Promise<LeadResult> {
  const parsed = leadInputSchema.safeParse(raw)
  if (!parsed.success) {
    const consentFailed = parsed.error.issues.some(
      (i) => i.path[0] === "consent"
    )
    return { ok: false, reason: consentFailed ? "consent" : "invalid" }
  }
  const input = parsed.data
  if (input.website) return { ok: true } // honeypot

  if (!(await verifyTurnstile(input.captchaToken, deps)))
    return { ok: false, reason: "captcha" }

  const base = deps.env.ALLFLOW_INGEST_URL?.replace(/\/+$/, "")
  const key = deps.env.ALLFLOW_INGEST_KEY
  if (!base || !key) return { ok: false, reason: "unavailable" }

  const body: Record<string, unknown> = {
    email: input.email,
    source: "landing",
    attributes: {
      consent: true,
      consent_at: deps.now().toISOString(),
      ...(input.message ? { message: input.message } : {}),
      ...(input.landing ? { landing: input.landing } : {}),
    },
  }
  if (input.name) body.name = input.name
  for (const k of ["utm_source", "utm_medium", "utm_campaign"] as const)
    if (input[k]) body[k] = input[k]

  try {
    const res = await deps.fetch(`${base}/contacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    })
    return res.ok ? { ok: true } : { ok: false, reason: "upstream" }
  } catch {
    return { ok: false, reason: "upstream" }
  }
}
