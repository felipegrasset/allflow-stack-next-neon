/**
 * What travels inside an encrypted push, and its validation. The service
 * worker (server/sw-script.ts) reads exactly these fields.
 */
import { z } from "zod"

/** Internal paths only: "/x", never "//host", "/\\host" or "https://…" (same rule as notifications). */
export const INTERNAL_HREF = /^\/(?![/\\])[^\s]*$/
/** RFC 8030 Section 5.4: Topic is at most 32 base64url characters. */
export const TOPIC = /^[A-Za-z0-9_-]{1,32}$/

export const pushPayloadSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(500).optional(),
  /** Where a click on the notification opens (internal path). */
  href: z.string().max(500).regex(INTERNAL_HREF).optional(),
  /** Same tag = the new notification replaces the old one on the device. */
  tag: z.string().trim().min(1).max(64).optional(),
})

export type PushPayload = z.input<typeof pushPayloadSchema>

export const sendOptionsSchema = z
  .object({
    /** Seconds the push service keeps the message for an offline device (RFC 8030 5.2). */
    ttl: z.number().int().min(0).max(28 * 24 * 3600).default(24 * 3600),
    urgency: z.enum(["very-low", "low", "normal", "high"]).default("normal"),
    /** Replaces a still-undelivered message with the same topic (RFC 8030 5.4). */
    topic: z.string().regex(TOPIC).optional(),
  })
  .default({ ttl: 24 * 3600, urgency: "normal" })

export type SendOptions = z.input<typeof sendOptionsSchema>
export type ResolvedSendOptions = z.output<typeof sendOptionsSchema>

/** The JSON the service worker receives (`url`, as the SW calls it). */
export function wirePayload(p: z.output<typeof pushPayloadSchema>): Uint8Array {
  const wire: Record<string, string> = { title: p.title }
  if (p.body) wire.body = p.body
  if (p.href) wire.url = p.href
  if (p.tag) wire.tag = p.tag
  return new TextEncoder().encode(JSON.stringify(wire))
}
