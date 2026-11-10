/**
 * Las cinco plantillas por arquetipo (T10). Cada una es una combinación de
 * bloques (`landing`) y un copy base en español (`copy`) que la spec de la app
 * reescribe. La génesis elige una por el arquetipo de la app y escribe su
 * `landing` en `landing.json` y su `copy` en `copy.ts` (pendiente, ver MODULE.md).
 */
import { bookingsServices } from "./bookings-services"
import { community } from "./community"
import { ecommerce } from "./ecommerce"
import { education } from "./education"
import { minimalTech } from "./minimal-tech"
import type { LandingTemplate } from "./types"

export const TEMPLATES = {
  ecommerce,
  "bookings-services": bookingsServices,
  education,
  "minimal-tech": minimalTech,
  community,
} as const satisfies Record<string, LandingTemplate>

export type TemplateId = keyof typeof TEMPLATES
export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[]
export type { LandingTemplate } from "./types"
