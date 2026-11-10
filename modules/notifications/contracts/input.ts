import { z } from "zod"

import { copy } from "../copy"

export const NOTIFICATION_KINDS = [
  "info",
  "success",
  "warning",
  "error",
] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

/** Solo rutas internas: "/algo", nunca "//host", "/\\host" ni "https://…" (evita un enlace de salida o un open redirect). */
export const INTERNAL_HREF = /^\/(?![/\\])[^\s]*$/

export const notifyInputSchema = z.object({
  /** Id del usuario (`"user".id`) que recibe el aviso. */
  userId: z.string().min(1),
  title: z
    .string()
    .trim()
    .min(1, copy.validation.title)
    .max(120, copy.validation.title),
  body: z.string().trim().max(500, copy.validation.body).optional(),
  href: z
    .string()
    .regex(INTERNAL_HREF, copy.validation.href)
    .max(500, copy.validation.href)
    .optional(),
  kind: z.enum(NOTIFICATION_KINDS).default("info"),
  /** Clave de idempotencia opcional: el mismo `id` dos veces crea un solo aviso. */
  id: z.string().min(1).max(200).optional(),
})

export type NotifyInput = z.input<typeof notifyInputSchema>

export type Notification = {
  id: string
  userId: string
  kind: NotificationKind
  title: string
  body: string | null
  href: string | null
  readAt: Date | null
  createdAt: Date
}

export type NotifyResult = { id: string; created: boolean }
