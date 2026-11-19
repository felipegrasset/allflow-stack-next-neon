/**
 * Zod schemas of catalog's forms, shared by the client (`zodResolver`) and the
 * Server Actions (`safeParse` again: actions are reachable by direct POST).
 * Factories, because the messages depend on the locale: pass
 * `copy.validation` (messages.ts). Pure: no `@/` imports.
 */
import { z } from "zod"

import {
  MAX_SLUG,
  SLUG,
  checkAttributes,
  parseAttributeLines,
} from "./domain"
import { parseAmount } from "./money"
import {
  CURRENCIES,
  ITEM_STATUSES,
  MANUAL_MOVE_REASONS,
  MAX_QTY,
  type Attributes,
  type ItemStatus,
} from "./types"

export type ValidationMessages = {
  required: string
  tooLong: string
  invalid: string
  slug: string
  price: string
  attributes: string
  quantity: string
  restockPositive: string
}

const INT = /^-?\d{1,9}$/

export function catalogSchemas(v?: Partial<ValidationMessages>) {
  const required = (max: number) =>
    z.string().trim().min(1, v?.required).max(max, v?.tooLong)
  const optional = (max: number) => z.string().trim().max(max, v?.tooLong)
  const slug = optional(MAX_SLUG).refine((s) => s === "" || SLUG.test(s), v?.slug)

  const itemSchema = z
    .object({
      name: required(200),
      /** "" = derive it from the name. */
      slug,
      description: optional(4000),
      price: required(30),
      currency: z.enum(CURRENCIES, v?.invalid),
      /** "" = no category. */
      categoryId: optional(100),
      status: z.enum(ITEM_STATUSES, v?.invalid),
      trackStock: z.boolean(),
      sku: optional(64),
      /** One `Key: value` per line. */
      attributes: optional(6000),
      /** Only when creating: stock on hand ("" = 0). Ignored when editing. */
      initialStock: optional(9),
    })
    .superRefine((d, ctx) => {
      if (parseAmount(d.price, d.currency) === null)
        ctx.addIssue({ code: "custom", path: ["price"], message: v?.price })
      const attrs = parseAttributeLines(d.attributes)
      if (attrs === null || checkAttributes(attrs) !== null)
        ctx.addIssue({ code: "custom", path: ["attributes"], message: v?.attributes })
      if (d.initialStock !== "") {
        const n = Number(d.initialStock)
        if (!/^\d+$/.test(d.initialStock) || n > MAX_QTY)
          ctx.addIssue({ code: "custom", path: ["initialStock"], message: v?.quantity })
      }
    })

  const categorySchema = z.object({
    name: required(100),
    slug,
    description: optional(500),
  })

  const stockMoveSchema = z
    .object({
      reason: z.enum(MANUAL_MOVE_REASONS, v?.invalid),
      /** Signed integer: "-2" takes two out (adjustment only). */
      qty: required(10),
      note: optional(300),
    })
    .superRefine((d, ctx) => {
      const n = Number(d.qty)
      if (!INT.test(d.qty) || n === 0 || Math.abs(n) > MAX_QTY)
        ctx.addIssue({ code: "custom", path: ["qty"], message: v?.quantity })
      else if (d.reason === "restock" && n < 0)
        ctx.addIssue({ code: "custom", path: ["qty"], message: v?.restockPositive })
    })

  const photoSchema = z.object({ fileId: required(100) })

  return { itemSchema, categorySchema, stockMoveSchema, photoSchema }
}

type Schemas = ReturnType<typeof catalogSchemas>
export type ItemFormValues = z.infer<Schemas["itemSchema"]>
export type CategoryFormValues = z.infer<Schemas["categorySchema"]>
export type StockMoveFormValues = z.infer<Schemas["stockMoveSchema"]>
export type PhotoFormValues = z.infer<Schemas["photoSchema"]>

/** What the store writes, from validated form values. */
export type ItemData = {
  name: string
  slug: string
  description: string | null
  priceMinor: number
  currency: string
  categoryId: string | null
  status: ItemStatus
  trackStock: boolean
  sku: string | null
  attributes: Attributes
}

/** Validated form values → ItemData. Call only after `itemSchema.safeParse` succeeded. */
export function toItemData(d: ItemFormValues): ItemData {
  const priceMinor = parseAmount(d.price, d.currency)
  const attributes = parseAttributeLines(d.attributes)
  if (priceMinor === null || attributes === null)
    throw new Error("catalog: toItemData recibió valores sin validar")
  return {
    name: d.name,
    slug: d.slug,
    description: d.description || null,
    priceMinor,
    currency: d.currency,
    categoryId: d.categoryId || null,
    status: d.status,
    trackStock: d.trackStock,
    sku: d.sku || null,
    attributes,
  }
}
