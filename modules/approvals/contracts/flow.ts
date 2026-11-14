/**
 * Flows as data: states, valid transitions and who may run each one. Pure
 * (zod only, relative imports): this is the engine, and what the tests cover.
 *
 * A flow is validated once (`defineFlow`) when it is saved, and again when a
 * request's snapshot is read back. A request keeps the definition it was
 * created with, so editing a flow never strands a request in a state that no
 * longer exists.
 */
import { z } from "zod"

import { ApprovalError } from "./errors"

/** Pseudo-role: the person who opened the request (e.g. to cancel it). */
export const REQUESTER_ROLE = "$requester"

const KEY = /^[a-z0-9][a-z0-9_-]{0,62}$/
/** An organization role name (owner, admin, member or a dynamic one) or `$requester`. */
const ROLE = /^(\$requester|[A-Za-z0-9][A-Za-z0-9_-]{0,63})$/

const keySchema = z.string().regex(KEY)

/** Flows are data an admin writes once, so every label carries both locales. */
export const localizedSchema = z.object({
  es: z.string().trim().min(1).max(80),
  en: z.string().trim().min(1).max(80),
})
export type Localized = z.infer<typeof localizedSchema>

export const flowStateSchema = z.object({
  key: keySchema,
  label: localizedSchema,
  /** A final state closes the request: no transition may leave it. */
  final: z.boolean().default(false),
})

export const flowTransitionSchema = z.object({
  /** Verb shown on the button and stored on the event ("approve", "reject"). Unique per `from`. */
  action: keySchema,
  from: keySchema,
  to: keySchema,
  label: localizedSchema,
  /** Who may run it: organization roles and/or `$requester`. */
  roles: z.array(z.string().regex(ROLE)).min(1).max(20),
  /** Whether the decision asks for a comment. */
  comment: z.enum(["none", "optional", "required"]).default("optional"),
})

export const flowDefinitionSchema = z
  .object({
    key: keySchema,
    name: localizedSchema,
    initial: keySchema,
    /**
     * false (default): the requester can never run a transition through an
     * organization role on their own request, only the ones that list
     * `$requester`. Nobody approves their own expense by accident.
     */
    allowSelfApproval: z.boolean().default(false),
    states: z.array(flowStateSchema).min(2).max(30),
    transitions: z.array(flowTransitionSchema).min(1).max(100),
  })
  .superRefine((flow, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: "custom", message, path })

    const states = new Map<string, { final: boolean }>()
    flow.states.forEach((s, i) => {
      if (states.has(s.key)) issue(`duplicate state "${s.key}"`, ["states", i, "key"])
      states.set(s.key, { final: s.final })
    })

    const initial = states.get(flow.initial)
    if (!initial) issue(`initial state "${flow.initial}" does not exist`, ["initial"])
    else if (initial.final) issue("the initial state cannot be final", ["initial"])
    if (![...states.values()].some((s) => s.final))
      issue("a flow needs at least one final state", ["states"])

    const seen = new Set<string>()
    flow.transitions.forEach((t, i) => {
      const from = states.get(t.from)
      if (!from) issue(`unknown state "${t.from}"`, ["transitions", i, "from"])
      else if (from.final)
        issue(`final state "${t.from}" cannot have transitions`, ["transitions", i, "from"])
      if (!states.has(t.to)) issue(`unknown state "${t.to}"`, ["transitions", i, "to"])
      if (t.from === t.to) issue("a transition must change the state", ["transitions", i, "to"])
      const id = `${t.from}:${t.action}`
      if (seen.has(id))
        issue(`action "${t.action}" is repeated from "${t.from}"`, ["transitions", i, "action"])
      seen.add(id)
    })

    // No dead ends: every non-final state can move on, every state is reachable.
    for (const [key, s] of states) {
      if (!s.final && !flow.transitions.some((t) => t.from === key))
        issue(`state "${key}" is not final and has no way out`, ["states"])
    }
    if (initial) {
      const reached = new Set([flow.initial])
      const queue = [flow.initial]
      while (queue.length) {
        const cur = queue.shift()!
        for (const t of flow.transitions)
          if (t.from === cur && !reached.has(t.to)) {
            reached.add(t.to)
            queue.push(t.to)
          }
      }
      for (const key of states.keys())
        if (!reached.has(key)) issue(`state "${key}" is unreachable from "${flow.initial}"`, ["states"])
    }
  })

export type FlowDefinitionInput = z.input<typeof flowDefinitionSchema>
export type FlowDefinition = z.output<typeof flowDefinitionSchema>
export type FlowState = FlowDefinition["states"][number]
export type FlowTransition = FlowDefinition["transitions"][number]

/** Validates a flow; throws `ApprovalError("invalid_flow")` with every issue in the message. */
export function defineFlow(input: FlowDefinitionInput): FlowDefinition {
  const r = flowDefinitionSchema.safeParse(input)
  if (!r.success)
    throw new ApprovalError(
      "invalid_flow",
      r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    )
  return r.data
}

/** Who is acting: their organization roles (a member may hold several). */
export type TransitionActor = { userId: string; roles: readonly string[] }

export type TransitionCheck =
  | { ok: true; transition: FlowTransition; asRequester: boolean }
  | {
      ok: false
      reason:
        | "unknown_state"
        | "final_state"
        | "unknown_action"
        | "role_not_allowed"
        | "self_approval"
    }

/**
 * Can `actor` run `action` on a request in `state`, opened by `requestedBy`?
 * Pure; says nothing about the `approval:*` permissions (see server/decision.ts).
 * `asRequester` tells whether the right came from `$requester` rather than a role.
 */
export function canTransition(
  flow: FlowDefinition,
  args: { state: string; action: string; actor: TransitionActor; requestedBy: string }
): TransitionCheck {
  const state = flow.states.find((s) => s.key === args.state)
  if (!state) return { ok: false, reason: "unknown_state" }
  if (state.final) return { ok: false, reason: "final_state" }
  const transition = flow.transitions.find(
    (t) => t.from === args.state && t.action === args.action
  )
  if (!transition) return { ok: false, reason: "unknown_action" }

  const isRequester = args.actor.userId === args.requestedBy
  if (isRequester && transition.roles.includes(REQUESTER_ROLE))
    return { ok: true, transition, asRequester: true }
  const byRole = transition.roles.some(
    (r) => r !== REQUESTER_ROLE && args.actor.roles.includes(r)
  )
  if (!byRole) return { ok: false, reason: "role_not_allowed" }
  if (isRequester && !flow.allowSelfApproval) return { ok: false, reason: "self_approval" }
  return { ok: true, transition, asRequester: false }
}

/** The transitions `actor` may run from `state` (by role and `$requester`; permissions apart). */
export function availableTransitions(
  flow: FlowDefinition,
  args: { state: string; actor: TransitionActor; requestedBy: string }
): FlowTransition[] {
  return flow.transitions
    .filter((t) => t.from === args.state)
    .filter((t) => canTransition(flow, { ...args, action: t.action }).ok)
}

export function findState(flow: FlowDefinition, key: string): FlowState | undefined {
  return flow.states.find((s) => s.key === key)
}

/** Picks the label of the active locale ("es" for anything else). */
export function localize(label: Localized, locale: string): string {
  return locale === "en" ? label.en : label.es
}
