/**
 * Who gets told what, through `notifications` (its contracts only). Best
 * effort: a failed notice never undoes a decision, it is logged and dropped.
 */
import { getLocale } from "next-intl/server"

import { RECIPIENTS_MAX_LIMIT, listUsersWithPermission, notify } from "@/modules/notifications/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"
import { getDefaultOrganizationId } from "@/server/session"

import { REQUESTER_ROLE, findState, localize, type FlowDefinition } from "../contracts/flow"
import { es } from "../messages"
import { splitRoles } from "./authz"

const MAX_RECIPIENTS = 50

/**
 * Members who can run a transition out of `state`: their role appears in one
 * of the flow's transitions (the flow decides WHICH roles) AND they hold
 * `approval:decide` (the permission, static or dynamic roles, resolved by
 * `listUsersWithPermission`). Both checks apply, as when the transition runs
 * (`canTransition` + the action's permission), so nobody is told about
 * something they could not do. `notifyPermission` is not used on purpose: it
 * would tell every `approval:decide` holder, whatever the flow says.
 */
async function decidersFor(def: FlowDefinition, state: string): Promise<string[]> {
  const wanted = new Set(
    def.transitions
      .filter((t) => t.from === state)
      .flatMap((t) => t.roles)
      .filter((r) => r !== REQUESTER_ROLE)
  )
  if (wanted.size === 0) return []
  const orgId = await getDefaultOrganizationId()
  if (!orgId) return []
  const { userIds: holders, truncated } = await listUsersWithPermission(
    { resource: "approval", action: "decide" },
    { limit: RECIPIENTS_MAX_LIMIT }
  )
  if (truncated) console.error("[approvals] notify: more approval:decide holders than the limit; some may not be told")
  const canDecide = new Set(holders)
  const members = await getKysely()
    .selectFrom("member")
    .select(["userId", "role"])
    .where("organizationId", "=", orgId)
    .limit(1000)
    .execute()
  return members
    .filter((m) => canDecide.has(m.userId) && splitRoles(m.role).some((r) => wanted.has(r)))
    .map((m) => m.userId)
}

export async function notifyAfterChange(args: {
  requestId: string
  eventId: string
  title: string
  definition: FlowDefinition
  state: string
  final: boolean
  actorId: string
  requestedBy: string
}): Promise<void> {
  try {
    const [copy, locale] = await Promise.all([getModuleCopy(es), getLocale()])
    const href = `/approvals/${args.requestId}`
    const state = findState(args.definition, args.state)
    const stateLabel = state ? localize(state.label, locale) : args.state

    const deciders = args.final ? [] : await decidersFor(args.definition, args.state)
    const sends: Promise<unknown>[] = []
    const seen = new Set<string>([args.actorId])
    for (const userId of deciders) {
      if (seen.has(userId) || seen.size > MAX_RECIPIENTS) continue
      // The requester is not asked to decide their own request.
      if (userId === args.requestedBy && !args.definition.allowSelfApproval) continue
      seen.add(userId)
      sends.push(
        notify({
          userId,
          title: copy.notify.pending(args.title).slice(0, 120),
          href,
          kind: "info",
          id: `approvals-${args.eventId}-${userId}`,
        })
      )
    }
    if (!seen.has(args.requestedBy)) {
      sends.push(
        notify({
          userId: args.requestedBy,
          title: copy.notify.changed(args.title, stateLabel).slice(0, 120),
          href,
          kind: args.final ? "success" : "info",
          id: `approvals-${args.eventId}-${args.requestedBy}`,
        })
      )
    }
    const results = await Promise.allSettled(sends)
    for (const r of results)
      if (r.status === "rejected") console.error("[approvals] notify failed", r.reason)
  } catch (e) {
    console.error("[approvals] notify failed", e)
  }
}
