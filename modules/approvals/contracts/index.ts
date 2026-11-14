/**
 * The only thing another module may import from `approvals`:
 *
 *   import { requestApproval, decide, getStatus, canTransition } from "@/modules/approvals/contracts"
 *
 *   await saveFlow(expenseFlow)                         // once, e.g. from your seed
 *   await requestApproval({ flowKey: "gasto", entity: "expense", entityId: id, title: "Taxi aeropuerto", href: `/expenses/${id}` })
 *   const s = await getStatus("expense", id)            // { state, stateLabel, final, … } | null
 *
 * `requestApproval`, `decide`, `getStatus` and `saveFlow` are server-only and
 * need a request context (they read the session / locale). Every failure is an
 * `ApprovalError` with a `code`. `canTransition`, `defineFlow` and the schemas
 * are pure.
 */
export { decide, getStatus, requestApproval, saveFlow } from "../server/api"
export {
  APPROVAL_ERROR_CODES,
  ApprovalError,
  isApprovalError,
  type ApprovalErrorCode,
} from "./errors"
export {
  REQUESTER_ROLE,
  availableTransitions,
  canTransition,
  defineFlow,
  flowDefinitionSchema,
  localize,
  type FlowDefinition,
  type FlowDefinitionInput,
  type FlowState,
  type FlowTransition,
  type Localized,
  type TransitionActor,
  type TransitionCheck,
} from "./flow"
export {
  decideInputSchema,
  requestApprovalInputSchema,
  type ApprovalEvent,
  type ApprovalStatus,
  type DecideInput,
  type DecideResult,
  type RequestApprovalInput,
  type RequestApprovalResult,
} from "./types"
