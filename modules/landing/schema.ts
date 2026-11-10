/**
 * El esquema de `landing.json` y el de los textos de cada bloque.
 *
 * Dos capas a propósito: `landing.json` dice QUÉ bloques van, en qué orden y con
 * qué variante (lo que edita el agente); el copy (`copy.ts`) dice QUÉ dice cada
 * uno. Un bloque apunta a su texto por una clave. Así traducir o reescribir no
 * toca la estructura, y el módulo `i18n` (T4) podrá levantar `copy.ts` entero.
 */
import { z } from "zod"

import { BLOCK_TYPES } from "./contracts"

export const VARIANTS = {
  hero: ["split", "centered"],
  social: ["logos", "stats"],
  features: ["columns", "bento"],
  steps: ["numbered", "timeline"],
  pricing: ["cards", "list"],
  faq: ["accordion", "columns"],
  lead: ["card", "inline"],
  cta: ["band", "split"],
  footer: ["simple", "columns"],
} as const

const slug = z.string().regex(/^[a-z][a-z0-9-]*$/, "kebab-case")
const copyKey = z.string().regex(/^[a-z][a-zA-Z0-9.-]*$/, "clave de copy")

const blockRef = <T extends keyof typeof VARIANTS>(type: T) =>
  z
    .object({
      id: slug,
      type: z.literal(type),
      variant: z.enum(VARIANTS[type]),
      copy: copyKey,
    })
    .strict()

export const landingSchema = z
  .object({
    version: z.literal(1),
    locale: z.enum(["es", "en"]),
    blocks: z
      .array(
        z.discriminatedUnion("type", [
          blockRef("hero"),
          blockRef("social"),
          blockRef("features"),
          blockRef("steps"),
          blockRef("pricing"),
          blockRef("faq"),
          blockRef("lead"),
          blockRef("cta"),
          blockRef("footer"),
        ])
      )
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const seen = new Set<string>()
    doc.blocks.forEach((b, i) => {
      if (seen.has(b.id))
        ctx.addIssue({
          code: "custom",
          path: ["blocks", i, "id"],
          message: `id repetido: ${b.id}`,
        })
      seen.add(b.id)
    })
  })

// ── Copy por bloque ──────────────────────────────────────────────────────────

const text = (max: number) => z.string().min(1).max(max)
const href = z
  .string()
  .regex(
    /^(\/|#|https?:\/\/|mailto:)/,
    "href relativo, ancla, http(s) o mailto"
  )
const link = z.object({ label: text(40), href }).strict()

export const ICONS = [
  "zap",
  "shield",
  "layers",
  "clock",
  "chart",
  "users",
  "sparkles",
  "globe",
] as const

export const heroCopy = z
  .object({
    eyebrow: text(40).optional(),
    title: text(90),
    subtitle: text(200),
    primary: link,
    secondary: link.optional(),
    /** El hero «muestra el resultado»: una maqueta de la app hecha con tokens. */
    mock: z
      .object({
        title: text(40),
        rows: z
          .array(z.object({ label: text(40), value: text(24) }).strict())
          .min(1)
          .max(4),
      })
      .strict()
      .optional(),
  })
  .strict()

export const socialCopy = z
  .object({
    heading: text(80).optional(),
    logos: z.array(text(24)).min(3).max(6).optional(),
    stats: z
      .array(z.object({ value: text(12), label: text(40) }).strict())
      .min(2)
      .max(4)
      .optional(),
  })
  .strict()

export const featuresCopy = z
  .object({
    heading: text(80),
    intro: text(160).optional(),
    // Una frase cada uno y de altura constante: el esquema topa el largo.
    items: z
      .array(
        z
          .object({
            title: text(40),
            body: text(120),
            icon: z.enum(ICONS).optional(),
          })
          .strict()
      )
      .min(3)
      .max(6),
  })
  .strict()

export const stepsCopy = z
  .object({
    heading: text(80),
    items: z
      .array(z.object({ title: text(40), body: text(120) }).strict())
      .min(3)
      .max(5),
  })
  .strict()

export const pricingCopy = z
  .object({
    heading: text(80),
    intro: text(160).optional(),
    plans: z
      .array(
        z
          .object({
            name: text(30),
            price: text(20),
            period: text(20).optional(),
            description: text(80).optional(),
            features: z.array(text(60)).min(1).max(6),
            cta: link,
            highlighted: z.boolean().optional(),
          })
          .strict()
      )
      .min(1)
      .max(4),
  })
  .strict()

export const faqCopy = z
  .object({
    heading: text(80),
    items: z
      .array(z.object({ q: text(120), a: text(400) }).strict())
      .min(3)
      .max(8),
  })
  .strict()

export const leadCopy = z
  .object({
    heading: text(80),
    subtitle: text(160).optional(),
    labels: z
      .object({
        name: text(30),
        email: text(30),
        message: text(30),
        consent: text(160),
        submit: text(30),
        sending: text(30),
      })
      .strict(),
    privacy: link.optional(),
    doneTitle: text(60),
    doneBody: text(160),
    errorGeneric: text(120),
    errorConsent: text(120),
    errorCaptcha: text(120),
  })
  .strict()

export const ctaCopy = z
  .object({
    title: text(90),
    subtitle: text(160).optional(),
    primary: link,
    secondary: link.optional(),
  })
  .strict()

export const footerCopy = z
  .object({
    tagline: text(120).optional(),
    columns: z
      .array(
        z
          .object({ title: text(30), links: z.array(link).min(1).max(6) })
          .strict()
      )
      .max(3),
    legal: text(120),
  })
  .strict()

export const COPY_SCHEMAS = {
  hero: heroCopy,
  social: socialCopy,
  features: featuresCopy,
  steps: stepsCopy,
  pricing: pricingCopy,
  faq: faqCopy,
  lead: leadCopy,
  cta: ctaCopy,
  footer: footerCopy,
} as const satisfies Record<(typeof BLOCK_TYPES)[number], z.ZodType>

/** Lo que una variante necesita del copy además de lo obligatorio. */
export const VARIANT_NEEDS: Record<string, string[]> = {
  "hero/centered": ["secondary"],
  "social/logos": ["logos"],
  "social/stats": ["stats"],
}

export type CopyOf<T extends keyof typeof COPY_SCHEMAS> = z.infer<
  (typeof COPY_SCHEMAS)[T]
>
export type CopySet = Record<string, unknown>
