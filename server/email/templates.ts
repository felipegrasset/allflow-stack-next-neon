import { APP_TITLE } from "@/lib/site"
import type { Email } from "./send"

/**
 * Auth email copy. Plain text on purpose (T1); the branded versions arrive with
 * the registry kits. Outside `server/auth/**`, so each app can edit its copy.
 */

export function verifyEmail(to: string, url: string): Email {
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

export function resetPasswordEmail(to: string, url: string): Email {
  return {
    to,
    subject: `Restablece tu contraseña de ${APP_TITLE}`,
    text: `Hola,\n\nPara elegir una contraseña nueva en ${APP_TITLE}, abre este enlace:\n\n${url}\n\nSi no lo pediste, ignora este mensaje.`,
  }
}
