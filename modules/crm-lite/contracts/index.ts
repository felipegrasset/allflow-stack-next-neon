/**
 * The only thing another module may import from `crm-lite`:
 *
 *   import { upsertContact, logActivity } from "@/modules/crm-lite/contracts"
 *   const { id } = await upsertContact({ name: "Ana Rojas", email: "ana@ejemplo.cl" })
 *   await logActivity({ contactId: id, kind: "note", body: "Llenó el formulario" })
 *
 * Server-only functions. They do NOT check permissions: they are for trusted
 * server code (a webhook, another module's action that already checked its
 * own). They validate with Zod and throw ZodError on bad input.
 */
export {
  getContact,
  listContactDeals,
  logActivity,
  upsertContact,
} from "../server/mutations"
export {
  CONTACT_STATUSES,
  CURRENCIES,
  DEAL_STAGES,
  MANUAL_ACTIVITY_KINDS,
  isClosedStage,
  type Activity,
  type ActivityKind,
  type Contact,
  type ContactStatus,
  type Deal,
  type DealStage,
} from "./domain"
export { currencyExponent, minorToMajor, parseAmount } from "./money"
export {
  logActivitySchema,
  upsertContactSchema,
  type LogActivityInput,
  type UpsertContactInput,
} from "./input"
