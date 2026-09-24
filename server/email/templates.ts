import { APP_TITLE } from "@/lib/site"
import type { Email } from "./send"

/**
 * Auth email copy. Plain text on purpose; outside `server/auth/**`, so each app
 * can edit its copy.
 *
 * Links (auth kit, T2): Better Auth builds its links against its API
 * (`/api/auth/verify-email?token=…`, `/api/auth/reset-password/<token>?…`).
 * The emails point to the app's own screens instead — `/verify-email/<token>`
 * and `/reset-password/<token>` — which show the loading / success / expired
 * states and then call the API themselves. Same token, same expiry.
 */

/** `/api/auth/verify-email?token=T&…` → `<origin>/verify-email/T` */
export function verificationPageUrl(apiUrl: string): string {
  const u = new URL(apiUrl)
  const token = u.searchParams.get("token")
  return token ? `${u.origin}/verify-email/${encodeURIComponent(token)}` : apiUrl
}

/** `/api/auth/reset-password/T?callbackURL=…` → `<origin>/reset-password/T` */
export function resetPageUrl(apiUrl: string): string {
  const u = new URL(apiUrl)
  const token = u.pathname.split("/reset-password/")[1]
  return token ? `${u.origin}/reset-password/${token}` : apiUrl
}

export function verifyEmail(to: string, apiUrl: string): Email {
  const url = verificationPageUrl(apiUrl)
  return {
    to,
    subject: `Confirma tu correo en ${APP_TITLE}`,
    text: `Hola,\n\nConfirma tu correo para activar tu cuenta en ${APP_TITLE}:\n\n${url}\n\nSi no creaste esta cuenta, ignora este mensaje.`,
  }
}

export function magicLinkEmail(to: string, url: string): Email {
  return {
    to,
    subject: `Tu enlace para entrar a ${APP_TITLE}`,
    text: `Hola,\n\nUsa este enlace para entrar a ${APP_TITLE}. Vence en 5 minutos y sirve una sola vez:\n\n${url}`,
  }
}

export function resetPasswordEmail(to: string, apiUrl: string): Email {
  const url = resetPageUrl(apiUrl)
  return {
    to,
    subject: `Restablece tu contraseña de ${APP_TITLE}`,
    text: `Hola,\n\nPara elegir una contraseña nueva en ${APP_TITLE}, abre este enlace (vence en una hora):\n\n${url}\n\nSi no lo pediste, ignora este mensaje.`,
  }
}
