/**
 * Zod schemas of what the management actions accept. Pure (tests import it).
 * The browser never sends a price, an amount or a subject: only plan ids and
 * entitlement values, and only someone with `plan:manage` can send them.
 */
import { z } from "zod"

import { ENTITLEMENT_KINDS, KEY_PATTERN, MAX_LIMIT, PLAN_REF_PATTERN } from "./domain"

const id = z.string().trim().min(1).max(100)
const optionalLabel = z
  .string()
  .trim()
  .max(80)
  .transform((s) => (s === "" ? null : s))
  .nullable()
  .optional()
  .transform((s) => s ?? null)

/**
 * Upsert one entitlement of one plan. `feature` uses `enabled`; `limit` uses
 * `limit` (`null` = unlimited, else an integer 0..MAX_LIMIT).
 */
export const setEntitlementSchema = z
  .object({
    planId: id,
    key: z.string().trim().toLowerCase().regex(KEY_PATTERN),
    kind: z.enum(ENTITLEMENT_KINDS),
    enabled: z.boolean().default(false),
    limit: z.number().int().min(0).max(MAX_LIMIT).nullable().default(null),
    labelEs: optionalLabel,
    labelEn: optionalLabel,
  })
  .transform((v) =>
    v.kind === "feature" ? { ...v, limit: null } : { ...v, enabled: false }
  )
export type SetEntitlementInput = z.input<typeof setEntitlementSchema>
export type SetEntitlement = z.output<typeof setEntitlementSchema>

/** A provider plan id, or "" (→ `null`: the plan is not mapped, so it cannot be sold). */
const planRef = z
  .string()
  .trim()
  .max(200)
  .refine((s) => s === "" || PLAN_REF_PATTERN.test(s))
  .transform((s) => (s === "" ? null : s))

/** Map (or unmap, with "") a plan to a provider plan id. */
export const setPlanRefSchema = z.object({ planId: id, planRef })
export type SetPlanRefInput = z.input<typeof setPlanRefSchema>

export const planIdSchema = z.object({ planId: id })

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((s) => (s ? s : null))

/** The editable fields of a plan. The browser never sends a price, only an informational price TEXT. */
const planFields = {
  nameEs: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  descriptionEs: optionalText(500),
  descriptionEn: optionalText(500),
  planRef,
  sort: z.number().int().min(-100_000).max(100_000),
  priceNoteEs: optionalText(60),
  priceNoteEn: optionalText(60),
}

/** Create a plan. It is born unpublished: selling it is a separate, explicit step. */
export const createPlanSchema = z.object({
  key: z.string().trim().toLowerCase().regex(KEY_PATTERN),
  ...planFields,
})
export type CreatePlanInput = z.input<typeof createPlanSchema>
export type CreatePlan = z.output<typeof createPlanSchema>

/** Edit a plan. The `key` is fixed once created (seeds and code may refer to it). */
export const updatePlanSchema = z.object({ planId: id, ...planFields })
export type UpdatePlanInput = z.input<typeof updatePlanSchema>
export type UpdatePlan = z.output<typeof updatePlanSchema>

export const setPublishedSchema = z.object({ planId: id, published: z.boolean() })
export type SetPublishedInput = z.input<typeof setPublishedSchema>

/**
 * Archive / unarchive. Archiving the default plan needs `newDefaultPlanId`
 * (another non-archived plan), applied in the same transaction.
 */
export const setArchivedSchema = z.object({
  planId: id,
  archived: z.boolean(),
  newDefaultPlanId: id.nullable().optional().transform((v) => v ?? null),
})
export type SetArchivedInput = z.input<typeof setArchivedSchema>

export const removeEntitlementSchema = z.object({
  planId: id,
  key: z.string().trim().toLowerCase().regex(KEY_PATTERN),
})
export type RemoveEntitlementInput = z.input<typeof removeEntitlementSchema>

/** /settings/plan: switch the live subscription to this plan. Only a plan id travels. */
export const changePlanSchema = z.object({ planId: id })

/** /settings/plan: cancel the live subscription; at period end unless said otherwise. */
export const cancelSubscriptionSchema = z.object({ atPeriodEnd: z.boolean().default(true) })
export type CancelSubscriptionInput = z.input<typeof cancelSubscriptionSchema>
