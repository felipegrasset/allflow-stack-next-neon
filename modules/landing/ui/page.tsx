import type { Metadata } from "next"
import { cookies, headers } from "next/headers"

import { APP_TITLE } from "@/lib/site"

import { copySets } from "../copy"
import landingJson from "../landing.json"
import { LOCALE_COOKIE, pickLandingLocale } from "../locale"
import { parseLanding, resolveLanding } from "../resolve"
import { AttributionCapture } from "./attribution-capture"
import { Landing, landingVars } from "./landing"
import "./landing.css"

export const metadata: Metadata = { title: { absolute: APP_TITLE } }

/**
 * Ruta pública del módulo (`/landing`, grupo marketing: sin sesión). Un
 * `landing.json` o un copy inválido tira acá con el id del bloque culpable.
 * El idioma sale de la cookie de i18n → Accept-Language → `landing.json`
 * (`locale.ts`); leer cookies y cabeceras hace la página dinámica, igual que
 * el resto del grupo marketing con i18n. Enlazarla a `/` es cosa de la génesis.
 */
export default async function LandingPage() {
  const doc = parseLanding(landingJson)
  const [jar, h] = await Promise.all([cookies(), headers()])
  const locale = pickLandingLocale(
    jar.get(LOCALE_COOKIE)?.value,
    h.get("accept-language"),
    doc.locale
  )
  const blocks = resolveLanding(doc, copySets[locale], landingVars())
  return (
    <div lang={locale}>
      <AttributionCapture />
      <Landing blocks={blocks} />
    </div>
  )
}
