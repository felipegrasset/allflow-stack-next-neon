/**
 * Errors of the plans module. `code` maps 1:1 to `plans.errors.<code>` in
 * messages.ts, so the UI shows a translated text and never `message`.
 */
import type { SubscriptionChangeErrorCode } from "@/modules/payments/contracts"

export const PLANS_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "invalid_input",
  "not_found",
  "kind_mismatch",
  "ref_taken",
  "conflict",
  "key_taken",
  "ref_required",
  "default_archived",
  "default_needs_replacement",
  "replacement_invalid",
  "already_subscribed",
  "not_subscribable",
  "not_changeable",
  "request_pending",
  "provider_unsupported",
  "sub_not_found",
  "sub_not_active",
  "sub_already_canceled",
  "sub_same_plan",
  "provider_error",
  "unknown",
] as const
export type PlansErrorCode = (typeof PLANS_ERROR_CODES)[number]

export class PlansError extends Error {
  constructor(public readonly code: PlansErrorCode) {
    super(`plans: ${code}`)
    this.name = "PlansError"
  }
}

/**
 * `SubscriptionChangeError.code` of payments → our code. `satisfies` makes
 * `tsc` fail if payments adds a code this module does not translate.
 */
export const SUBSCRIPTION_CHANGE_ERRORS = {
  not_found: "sub_not_found",
  not_active: "sub_not_active",
  already_canceled: "sub_already_canceled",
  same_plan: "sub_same_plan",
} as const satisfies Record<SubscriptionChangeErrorCode, PlansErrorCode>
