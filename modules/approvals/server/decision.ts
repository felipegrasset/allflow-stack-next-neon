/**
 * Pure decision rules on top of the flow engine: what `decide` checks before
 * touching the database. Kept free of `@/` imports so the tests run it.
 */
import { ApprovalError } from "../contracts/errors"
import { canTransition, type FlowDefinition, type FlowTransition } from "../contracts/flow"

/** The person acting, resolved from the session (server/authz.ts). */
export type Actor = {
  userId: string
  /** Organization roles of the actor ("admin", "member", dynamic ones). */
  roles: string[]
  /** `approval:request` and `approval:decide`, from Better Auth (static + dynamic roles). */
  can: { request: boolean; decide: boolean }
}

export type RequestSnapshot = {
  state: string
  requestedBy: string
  closedAt: Date | null
  definition: FlowDefinition
}

/**
 * Throws `ApprovalError` unless `actor` may run `action` now. Rules:
 * - the transition must exist from the current state (else `invalid_transition`);
 * - by role it needs `approval:decide`; as `$requester`, `approval:request`;
 * - the requester never decides their own request by role unless the flow allows it;
 * - a `required` comment must be present; `expectedState` must match.
 */
export function planDecision(
  req: RequestSnapshot,
  actor: Actor,
  input: { action: string; comment?: string; expectedState?: string }
): FlowTransition {
  if (input.expectedState !== undefined && input.expectedState !== req.state)
    throw new ApprovalError("conflict", `request is in "${req.state}", not "${input.expectedState}"`)
  if (req.closedAt) throw new ApprovalError("invalid_transition", "request is closed")
  const check = canTransition(req.definition, {
    state: req.state,
    action: input.action,
    actor,
    requestedBy: req.requestedBy,
  })
  if (!check.ok) {
    if (check.reason === "self_approval") throw new ApprovalError("self_approval")
    if (check.reason === "role_not_allowed") throw new ApprovalError("forbidden", "role not allowed")
    throw new ApprovalError("invalid_transition", `${check.reason}: "${input.action}" from "${req.state}"`)
  }
  const needed = check.asRequester ? actor.can.request : actor.can.decide
  if (!needed)
    throw new ApprovalError(
      "forbidden",
      check.asRequester ? "missing approval:request" : "missing approval:decide"
    )
  if (check.transition.comment === "required" && !input.comment?.trim())
    throw new ApprovalError("comment_required")
  return check.transition
}

/** Comment as stored: trimmed, null when empty or when the transition takes none. */
export function storedComment(t: FlowTransition, comment: string | undefined): string | null {
  if (t.comment === "none") return null
  const c = comment?.trim()
  return c ? c : null
}
