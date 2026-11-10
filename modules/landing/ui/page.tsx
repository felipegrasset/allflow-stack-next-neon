import type { Metadata } from "next"

import { APP_TITLE } from "@/lib/site"

import { copySets } from "../copy"
import landingJson from "../landing.json"
import { parseLanding, resolveLanding } from "../resolve"
import { AttributionCapture } from "./attribution-capture"
import { Landing, landingVars } from "./landing"
import "./landing.css"

export const metadata: Metadata = { title: { absolute: APP_TITLE } }

/**
 * Ruta pública del módulo (`/landing`, grupo marketing: sin sesión). Un
 * `landing.json` o un copy inválido tira acá, en el build, con el id del
 * bloque culpable. Enlazarla a `/` es cosa de la génesis (T10).
 */
export default function LandingPage() {
  const doc = parseLanding(landingJson)
  const blocks = resolveLanding(doc, copySets[doc.locale], landingVars())
  return (
    <div lang={doc.locale}>
      <AttributionCapture />
      <Landing blocks={blocks} />
    </div>
  )
}
