/**
 * Zod schemas of help-center. One schema per form, used by the Server Action
 * (actions are reachable by direct POST) and by server-to-server callers.
 * Factories because the messages depend on the locale: pass
 * `copy.validation`. Pure: no `@/` imports.
 */
import { z } from "zod"

export const ARTICLE_LOCALES = ["es", "en"] as const
export type ArticleLocale = (typeof ARTICLE_LOCALES)[number]

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const MAX_SLUG = 80
export const MAX_BODY = 20000

/** "Cómo cambiar tu contraseña" → "como-cambiar-tu-contrasena". */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, "")
}

export type ValidationMessages = {
  required: string
  tooLong: string
  slug: string
  invalid: string
}

export function articleSchemas(v?: Partial<ValidationMessages>) {
  const articleSchema = z
    .object({
      title: z.string().trim().min(1, v?.required).max(160, v?.tooLong),
      /** "" = derive it from the title. */
      slug: z.string().trim().max(MAX_SLUG, v?.tooLong),
      summary: z.string().trim().max(300, v?.tooLong),
      category: z.string().trim().max(60, v?.tooLong),
      locale: z.enum(ARTICLE_LOCALES, v?.invalid),
      sortOrder: z.number(v?.invalid).int(v?.invalid).min(0, v?.invalid).max(9999, v?.invalid),
      body: z.string().trim().min(1, v?.required).max(MAX_BODY, v?.tooLong),
      published: z.boolean(),
    })
    .transform((a) => ({ ...a, slug: a.slug === "" ? slugify(a.title) : a.slug }))
    .superRefine((a, ctx) => {
      if (!SLUG_RE.test(a.slug)) ctx.addIssue({ code: "custom", path: ["slug"], message: v?.slug })
    })

  const feedbackSchema = z.object({
    slug: z.string().min(1, v?.invalid).max(MAX_SLUG, v?.invalid).regex(SLUG_RE, v?.invalid),
    helpful: z.enum(["yes", "no"], v?.invalid),
    comment: z.string().trim().max(500, v?.tooLong),
  })

  const idSchema = z.object({ id: z.string().min(1, v?.invalid).max(100, v?.invalid) })

  return { articleSchema, feedbackSchema, idSchema }
}

type Schemas = ReturnType<typeof articleSchemas>
export type ArticleInput = z.output<Schemas["articleSchema"]>
export type ArticleFormInput = z.input<Schemas["articleSchema"]>
export type FeedbackInput = z.infer<Schemas["feedbackSchema"]>
