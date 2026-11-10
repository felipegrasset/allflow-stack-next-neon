/**
 * Atribución de primer toque (UTM), pura: sin Next ni `window`. La guarda
 * `AttributionCapture` en la cookie `fv_attr` (90 días) y el formulario la lee
 * al enviar. Código propio, mismo formato de cookie que el sitio de AllFlow.
 */
export const ATTR_COOKIE = "fv_attr"
export const ATTR_MAX_AGE = 60 * 60 * 24 * 90
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const
export type Utm = Partial<Record<(typeof UTM_KEYS)[number], string>>

const MAX = 160

export function utmFromSearch(search: string): Utm {
  const params = new URLSearchParams(search)
  const out: Utm = {}
  for (const k of UTM_KEYS) {
    const v = params.get(k)
    if (v) out[k] = v.slice(0, MAX)
  }
  return out
}

export function encodeUtm(u: Utm): string {
  return encodeURIComponent(JSON.stringify(u))
}

/** Tolera basura: cualquier fallo da `{}`. */
export function decodeUtm(raw: string | null | undefined): Utm {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw))
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {}
    const out: Utm = {}
    for (const k of UTM_KEYS) {
      const v = (parsed as Record<string, unknown>)[k]
      if (typeof v === "string" && v) out[k] = v.slice(0, MAX)
    }
    return out
  } catch {
    return {}
  }
}

export function readCookie(cookie: string, name: string): string | null {
  for (const part of cookie.split(";")) {
    const [k, ...rest] = part.trim().split("=")
    if (k === name) return rest.join("=")
  }
  return null
}
