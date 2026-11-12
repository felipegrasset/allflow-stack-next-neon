import { z } from "zod"

import { currencyExponent } from "./money"
import { PROVIDER_IDS } from "./types"

/** Ruta interna: empieza con una sola `/`, sin esquema, sin `//`, sin `\` ni espacios (evita redirecciones abiertas). */
export const INTERNAL_PATH = /^\/(?![/\\])[^\s\\]*$/

const currency = z
  .string()
  .regex(/^[A-Za-z]{3}$/, "moneda ISO 4217 de tres letras")
  .transform((c) => c.toUpperCase())
  .refine((c) => {
    try {
      currencyExponent(c)
      return true
    } catch {
      return false
    }
  }, "moneda desconocida")

export const checkoutInputSchema = z.object({
  orderId: z.string().trim().min(1).max(200),
  amountMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  currency,
  description: z.string().trim().min(1).max(200),
  payerEmail: z.string().trim().email().max(254).optional(),
  returnPath: z
    .string()
    .regex(INTERNAL_PATH, "ruta interna, p. ej. /orders/42")
    .max(500),
  provider: z.enum(PROVIDER_IDS).optional(),
})

export const subscriptionInputSchema = z.object({
  subscriberRef: z.string().trim().min(1).max(200),
  planRef: z.string().trim().min(1).max(200),
  payerEmail: z.string().trim().email().max(254).optional(),
  returnPath: z
    .string()
    .regex(INTERNAL_PATH, "ruta interna, p. ej. /billing")
    .max(500),
  provider: z.enum(PROVIDER_IDS).optional(),
})
