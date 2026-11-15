/**
 * A form is data: a title and a list of typed fields, validated with Zod.
 * Pure (zod only, relative imports): the engine, the UI, the tests and other
 * modules can all use it.
 *
 * Field ids are `[a-z][a-z0-9_]*`: they become form control names (`f_<id>`)
 * and the keys of the stored answers, so they never collide with object
 * prototype names (`__proto__`) and need no escaping.
 */
import { z } from "zod"

import { FormError } from "./errors"

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "single",
  "multiple",
  "scale",
  "date",
  "email",
  "consent",
] as const
export type FieldType = (typeof FIELD_TYPES)[number]

const FIELD_ID = /^[a-z][a-z0-9_]{0,39}$/
const OPTION_VALUE = /^[a-z0-9][a-z0-9_-]{0,39}$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** URL slug of the public page: `/f/<slug>`. */
export const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/)

/** Visible text: one string, or one per locale. */
export const textSchema = z.union([
  z.string().trim().min(1).max(300),
  z.object({
    es: z.string().trim().min(1).max(300),
    en: z.string().trim().min(1).max(300),
  }),
])
export type LocalizedText = z.infer<typeof textSchema>

/** The text in the given locale (a plain string is used as is). */
export function resolveText(text: LocalizedText, locale: string): string {
  return typeof text === "string" ? text : locale === "en" ? text.en : text.es
}

/** A calendar date `YYYY-MM-DD` that really exists (no 2026-02-31). */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const [y, m, d] = value.split("-").map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

const isoDate = z.string().refine(isIsoDate, "not a valid YYYY-MM-DD date")

const base = {
  id: z.string().regex(FIELD_ID),
  label: textSchema,
  help: textSchema.optional(),
  required: z.boolean().default(false),
}

const optionSchema = z.object({
  value: z.string().regex(OPTION_VALUE),
  label: textSchema,
})

export const fieldSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), ...base, maxLength: z.number().int().min(1).max(500).default(200) }),
  z.object({ type: z.literal("textarea"), ...base, maxLength: z.number().int().min(1).max(5000).default(2000) }),
  z.object({
    type: z.literal("number"),
    ...base,
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    integer: z.boolean().default(false),
  }),
  z.object({ type: z.literal("single"), ...base, options: z.array(optionSchema).min(2).max(50) }),
  z.object({
    type: z.literal("multiple"),
    ...base,
    options: z.array(optionSchema).min(2).max(50),
    maxChoices: z.number().int().min(1).max(50).optional(),
  }),
  z.object({
    type: z.literal("scale"),
    ...base,
    from: z.union([z.literal(0), z.literal(1)]).default(1),
    to: z.number().int().min(2).max(10).default(5),
    lowLabel: textSchema.optional(),
    highLabel: textSchema.optional(),
  }),
  z.object({ type: z.literal("date"), ...base, min: isoDate.optional(), max: isoDate.optional() }),
  z.object({ type: z.literal("email"), ...base }),
  /** The label is the statement; when required, the box must be ticked. */
  z.object({ type: z.literal("consent"), ...base }),
])
export type Field = z.output<typeof fieldSchema>
export type FieldInput = z.input<typeof fieldSchema>

export const formDefinitionSchema = z
  .object({
    title: textSchema,
    description: textSchema.optional(),
    /** Shown after sending. A generic thank-you when omitted. */
    thanks: textSchema.optional(),
    fields: z.array(fieldSchema).min(1).max(50),
  })
  .superRefine((def, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: "custom", message, path })
    const seen = new Set<string>()
    def.fields.forEach((f, i) => {
      if (seen.has(f.id)) issue(`duplicate field id "${f.id}"`, ["fields", i, "id"])
      seen.add(f.id)
      if (f.type === "single" || f.type === "multiple") {
        const values = new Set<string>()
        f.options.forEach((o, j) => {
          if (values.has(o.value)) issue(`duplicate option "${o.value}"`, ["fields", i, "options", j, "value"])
          values.add(o.value)
        })
      }
      if (f.type === "multiple" && f.maxChoices !== undefined && f.maxChoices > f.options.length)
        issue("maxChoices is larger than the number of options", ["fields", i, "maxChoices"])
      if ((f.type === "number" || f.type === "date") && f.min !== undefined && f.max !== undefined && f.min > f.max)
        issue("min is greater than max", ["fields", i, "min"])
      if (f.type === "scale" && f.to <= f.from)
        issue("the scale needs at least two values", ["fields", i, "to"])
    })
  })

export type FormDefinition = z.output<typeof formDefinitionSchema>
export type FormDefinitionInput = z.input<typeof formDefinitionSchema>

/** Validates a definition; throws `FormError("invalid_definition")` listing every issue. */
export function defineForm(input: unknown): FormDefinition {
  const r = formDefinitionSchema.safeParse(input)
  if (!r.success) throw new FormError("invalid_definition", describeIssues(r.error).join("; "))
  return r.data
}

/** `path: message` lines, for showing to whoever wrote the definition. */
export function describeIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 20).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
}
