/**
 * approvals v0.1 — what runs without a database: the flow validator, the
 * transition engine, the decision rules (permissions, self-approval, comments,
 * stale state), the catalog and, reading the code, the guards of the actions.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { ApprovalError } from "../contracts/errors"
import {
  availableTransitions,
  canTransition,
  defineFlow,
  flowDefinitionSchema,
  type FlowDefinitionInput,
} from "../contracts/flow"
import { requestApprovalInputSchema } from "../contracts/types"
import { EXAMPLE_FLOWS, EXPENSE_FLOW, SIMPLE_FLOW } from "../flows"
import { en, es } from "../messages"
import { permissions } from "../permissions"
import { planDecision, storedComment, type Actor } from "../server/decision"

const simple = defineFlow(SIMPLE_FLOW)
const expense = defineFlow(EXPENSE_FLOW)

const admin: Actor = { userId: "u-admin", roles: ["admin"], can: { request: true, decide: true } }
const owner: Actor = { userId: "u-owner", roles: ["owner"], can: { request: true, decide: true } }
const member: Actor = { userId: "u-member", roles: ["member"], can: { request: true, decide: false } }

function expectCode(fn: () => unknown, code: string) {
  assert.throws(fn, (e: unknown) => e instanceof ApprovalError && e.code === code)
}

test("the example flows are valid", () => {
  for (const f of EXAMPLE_FLOWS) assert.doesNotThrow(() => defineFlow(f), f.key)
})

test("defineFlow rejects broken flows with invalid_flow", () => {
  const broken: FlowDefinitionInput[] = [
    { ...SIMPLE_FLOW, initial: "nope" },
    { ...SIMPLE_FLOW, initial: "approved" },
    { ...SIMPLE_FLOW, states: SIMPLE_FLOW.states.map((s) => ({ ...s, final: false })) },
    { ...SIMPLE_FLOW, states: [...SIMPLE_FLOW.states, SIMPLE_FLOW.states[0]] },
    { ...SIMPLE_FLOW, transitions: [...SIMPLE_FLOW.transitions, { ...SIMPLE_FLOW.transitions[0], from: "approved" }] },
    { ...SIMPLE_FLOW, transitions: [...SIMPLE_FLOW.transitions, { ...SIMPLE_FLOW.transitions[0], to: "ghost" }] },
    { ...SIMPLE_FLOW, transitions: [...SIMPLE_FLOW.transitions, { ...SIMPLE_FLOW.transitions[0] }] },
    { ...SIMPLE_FLOW, transitions: [{ ...SIMPLE_FLOW.transitions[0], roles: [] }] },
    { ...SIMPLE_FLOW, transitions: [{ ...SIMPLE_FLOW.transitions[0], roles: ["admin; drop"] }] },
    // "rejected" and "cancelled" become unreachable.
    { ...SIMPLE_FLOW, transitions: [SIMPLE_FLOW.transitions[0]] },
    // a non-final state with no way out
    { ...SIMPLE_FLOW, states: [...SIMPLE_FLOW.states, { key: "limbo", label: { es: "Limbo", en: "Limbo" } }] },
  ]
  for (const [i, f] of broken.entries()) expectCode(() => defineFlow(f), "invalid_flow"), void i
  assert.equal(flowDefinitionSchema.safeParse({ ...SIMPLE_FLOW, key: "Con Espacio" }).success, false)
})

test("canTransition: roles, final states and unknown actions", () => {
  const args = { state: "pending", requestedBy: "u-member" }
  assert.equal(canTransition(simple, { ...args, action: "approve", actor: admin }).ok, true)
  assert.deepEqual(canTransition(simple, { ...args, action: "approve", actor: member }), { ok: false, reason: "role_not_allowed" })
  assert.deepEqual(canTransition(simple, { ...args, action: "fly", actor: admin }), { ok: false, reason: "unknown_action" })
  assert.deepEqual(canTransition(simple, { ...args, state: "approved", action: "approve", actor: admin }), { ok: false, reason: "final_state" })
  assert.deepEqual(canTransition(simple, { ...args, state: "ghost", action: "approve", actor: admin }), { ok: false, reason: "unknown_state" })
  // an action valid elsewhere is not valid from this state
  assert.deepEqual(canTransition(expense, { state: "submitted", requestedBy: "x", action: "approve", actor: owner }), { ok: false, reason: "unknown_action" })
})

test("canTransition: $requester, and no self-approval by default", () => {
  const mine = { state: "pending", requestedBy: "u-admin" }
  const cancel = canTransition(simple, { ...mine, action: "cancel", actor: admin })
  assert.equal(cancel.ok && cancel.asRequester, true)
  assert.deepEqual(canTransition(simple, { ...mine, action: "approve", actor: admin }), { ok: false, reason: "self_approval" })
  // someone else cannot run a $requester transition
  assert.deepEqual(canTransition(simple, { state: "pending", requestedBy: "u-member", action: "cancel", actor: admin }), { ok: false, reason: "role_not_allowed" })
  const lax = defineFlow({ ...SIMPLE_FLOW, allowSelfApproval: true })
  assert.equal(canTransition(lax, { ...mine, action: "approve", actor: admin }).ok, true)
})

test("availableTransitions lists only what the actor may run", () => {
  const forAdmin = availableTransitions(simple, { state: "pending", actor: admin, requestedBy: "u-member" })
  assert.deepEqual(forAdmin.map((t) => t.action), ["approve", "reject"])
  const forRequester = availableTransitions(simple, { state: "pending", actor: member, requestedBy: "u-member" })
  assert.deepEqual(forRequester.map((t) => t.action), ["cancel"])
})

test("planDecision: permission, comment, stale state and closed requests", () => {
  const req = { state: "pending", requestedBy: "u-member", closedAt: null, definition: simple }
  assert.equal(planDecision(req, admin, { action: "approve" }).to, "approved")
  expectCode(() => planDecision(req, { ...admin, can: { request: true, decide: false } }, { action: "approve" }), "forbidden")
  expectCode(() => planDecision(req, admin, { action: "reject" }), "comment_required")
  expectCode(() => planDecision(req, admin, { action: "reject", comment: "   " }), "comment_required")
  assert.equal(planDecision(req, admin, { action: "reject", comment: "Falta la boleta" }).to, "rejected")
  expectCode(() => planDecision(req, admin, { action: "approve", expectedState: "reviewed" }), "conflict")
  expectCode(() => planDecision(req, admin, { action: "nope" }), "invalid_transition")
  expectCode(() => planDecision({ ...req, closedAt: new Date() }, admin, { action: "approve" }), "invalid_transition")
  expectCode(() => planDecision({ ...req, state: "approved" }, admin, { action: "approve" }), "invalid_transition")
  expectCode(() => planDecision({ ...req, requestedBy: "u-admin" }, admin, { action: "approve" }), "self_approval")
  // cancelling one's own request needs approval:request, not decide
  assert.equal(planDecision(req, member, { action: "cancel" }).to, "cancelled")
  expectCode(() => planDecision(req, { ...member, can: { request: false, decide: false } }, { action: "cancel" }), "forbidden")
})

test("storedComment trims, drops empty, and ignores it when the transition takes none", () => {
  const [approve, , cancel] = simple.transitions
  assert.equal(storedComment(approve, "  ok  "), "ok")
  assert.equal(storedComment(approve, "   "), null)
  assert.equal(storedComment(cancel, "texto"), null)
})

test("requestApproval input: internal href only, entity is a key", () => {
  const base = { flowKey: "aprobacion-simple", entity: "expense", entityId: "e-1", title: "Taxi" }
  assert.equal(requestApprovalInputSchema.safeParse(base).success, true)
  for (const href of ["https://evil.example", "//evil.example", "/\\evil", "javascript:alert(1)"])
    assert.equal(requestApprovalInputSchema.safeParse({ ...base, href }).success, false, href)
  assert.equal(requestApprovalInputSchema.safeParse({ ...base, entity: "Expense Table" }).success, false)
  assert.equal(requestApprovalInputSchema.safeParse({ ...base, title: " " }).success, false)
})

test("catalog: same keys in es and en, and an error text per code", () => {
  const keys = (o: object, p = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [p + k] : keys(v, `${p}${k}.`)))
  assert.deepEqual(keys(en).sort(), keys(es).sort())
  for (const code of ["unauthenticated", "forbidden", "invalid_transition", "self_approval", "conflict", "unknown"])
    assert.ok(code in es.approvals.errors, code)
})

test("permissions: member requests, nobody else's grants change", () => {
  assert.deepEqual(permissions.statement, { approval: ["request", "decide"] })
  assert.deepEqual(permissions.grants.member, { approval: ["request"] })
})

test("source: actions guard the session; state changes go through planDecision and a row lock", () => {
  const dir = join(process.cwd(), "modules", "approvals")
  const actions = readFileSync(join(dir, "server/actions.ts"), "utf8")
  assert.match(actions, /^"use server"/)
  assert.match(actions, /await requireOnboardedUser\(/)
  assert.match(actions, /safeParse\(/)
  const store = readFileSync(join(dir, "server/store.ts"), "utf8")
  assert.match(store, /\.forUpdate\(\)/)
  assert.match(store, /planDecision\(/)
  assert.match(store, /insertInto\("approvals_events"\)/)
  assert.doesNotMatch(store, /sql`/)
})
