/**
 * tickets v0.1 — what runs without a database: visibility, status moves,
 * reply rules, who gets notified, the Zod schemas, the catalog, the manifest,
 * permissions and, reading the code, the guards of the Server Actions and the
 * row lock of the store. Relative imports only, so it runs transpiled without
 * the `@/` alias.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  TICKET_STATUSES,
  availableStatusMoves,
  canView,
  messageRecipients,
  planReply,
  planStatusChange,
  type Viewer,
} from "../contracts/domain"
import { openTicketInputSchema, ticketSchemas } from "../contracts/input"
import { en, es } from "../messages"
import { permissions } from "../permissions"

const DIR = join(process.cwd(), "modules", "tickets")
const read = (rel: string) => readFileSync(join(DIR, rel), "utf8")

const owner: Viewer = { userId: "u-owner", canManage: false }
const stranger: Viewer = { userId: "u-other", canManage: false }
const staff: Viewer = { userId: "u-staff", canManage: true }
const t = (status: (typeof TICKET_STATUSES)[number]) => ({ requesterId: "u-owner", status })

test("canView: own tickets, or everything with manage", () => {
  assert.equal(canView(t("open"), owner), true)
  assert.equal(canView(t("open"), stranger), false)
  assert.equal(canView(t("open"), staff), true)
})

test("planStatusChange: a stranger gets not_found, never forbidden", () => {
  assert.deepEqual(planStatusChange(t("open"), "closed", stranger), { ok: false, reason: "not_found" })
})

test("planStatusChange: requester may only close and reopen", () => {
  assert.deepEqual(planStatusChange(t("open"), "closed", owner), { ok: true, closes: true })
  assert.deepEqual(planStatusChange(t("closed"), "open", owner), { ok: true, closes: false })
  assert.deepEqual(planStatusChange(t("resolved"), "open", owner), { ok: true, closes: false })
  assert.deepEqual(planStatusChange(t("open"), "resolved", owner), { ok: false, reason: "invalid_transition" })
  assert.deepEqual(planStatusChange(t("open"), "in_progress", owner), { ok: false, reason: "invalid_transition" })
})

test("planStatusChange: staff moves, same status and closed → only reopen", () => {
  assert.deepEqual(planStatusChange(t("open"), "resolved", staff), { ok: true, closes: false })
  assert.deepEqual(planStatusChange(t("in_progress"), "resolved", staff), { ok: true, closes: false })
  assert.deepEqual(planStatusChange(t("open"), "open", staff), { ok: false, reason: "same_status" })
  assert.deepEqual(planStatusChange(t("closed"), "resolved", staff), { ok: false, reason: "invalid_transition" })
  assert.deepEqual(planStatusChange(t("closed"), "open", staff), { ok: true, closes: false })
})

test("availableStatusMoves matches planStatusChange for every status and viewer", () => {
  for (const status of TICKET_STATUSES)
    for (const viewer of [owner, stranger, staff]) {
      const moves = availableStatusMoves(t(status), viewer)
      for (const to of TICKET_STATUSES)
        assert.equal(moves.includes(to), planStatusChange(t(status), to, viewer).ok, `${status}->${to}`)
    }
})

test("planReply: kind and next status", () => {
  assert.deepEqual(planReply(t("open"), staff), { ok: true, kind: "staff", nextStatus: "in_progress" })
  assert.deepEqual(planReply(t("in_progress"), staff), { ok: true, kind: "staff", nextStatus: "in_progress" })
  assert.deepEqual(planReply(t("resolved"), staff), { ok: true, kind: "staff", nextStatus: "resolved" })
  assert.deepEqual(planReply(t("resolved"), owner), { ok: true, kind: "requester", nextStatus: "open" })
  assert.deepEqual(planReply(t("open"), owner), { ok: true, kind: "requester", nextStatus: "open" })
  // a manager answering their own ticket is the requester
  const self = { userId: "u-owner", canManage: true }
  assert.equal(planReply(t("open"), self).ok && (planReply(t("open"), self) as { kind: string }).kind, "requester")
})

test("planReply: closed takes no messages, strangers see nothing", () => {
  assert.deepEqual(planReply(t("closed"), owner), { ok: false, reason: "closed" })
  assert.deepEqual(planReply(t("closed"), staff), { ok: false, reason: "closed" })
  assert.deepEqual(planReply(t("open"), stranger), { ok: false, reason: "not_found" })
})

test("messageRecipients: requester hears staff, managers hear the requester, never the author", () => {
  assert.deepEqual(
    messageRecipients({ kind: "staff", authorId: "u-staff", requesterId: "u-owner", managerIds: ["u-staff", "u-b"] }),
    ["u-owner"]
  )
  assert.deepEqual(
    messageRecipients({ kind: "requester", authorId: "u-owner", requesterId: "u-owner", managerIds: ["u-a", "u-b", "u-a"] }),
    ["u-a", "u-b"]
  )
  // a manager who is also the requester is not told about their own message
  assert.deepEqual(
    messageRecipients({ kind: "requester", authorId: "u-a", requesterId: "u-a", managerIds: ["u-a", "u-b"] }),
    ["u-b"]
  )
  assert.deepEqual(
    messageRecipients({ kind: "staff", authorId: "u-owner", requesterId: "u-owner", managerIds: [] }),
    []
  )
})

test("schemas: create requires subject and body, closed priority list, localized messages", () => {
  const { createSchema, replySchema, statusSchema } = ticketSchemas({ required: "REQ", invalid: "INV" })
  assert.equal(createSchema.safeParse({ subject: "Hola", body: "Texto", priority: "high" }).success, true)
  const bad = createSchema.safeParse({ subject: "  ", body: "x", priority: "urgent" })
  assert.equal(bad.success, false)
  if (!bad.success) {
    const msgs = Object.fromEntries(bad.error.issues.map((i) => [String(i.path[0]), i.message]))
    assert.equal(msgs.subject, "REQ")
    assert.equal(msgs.priority, "INV")
  }
  assert.equal(createSchema.safeParse({ subject: "a".repeat(201), body: "x", priority: "low" }).success, false)
  assert.equal(replySchema.safeParse({ body: "   " }).success, false)
  assert.equal(statusSchema.safeParse({ status: "deleted" }).success, false)
  assert.equal(statusSchema.safeParse({ status: "resolved" }).success, true)
})

test("openTicket input: priority defaults, entity is a key", () => {
  const ok = openTicketInputSchema.parse({ subject: "No puedo pagar", body: "Falla el pago" })
  assert.equal(ok.priority, "normal")
  assert.equal(openTicketInputSchema.safeParse({ subject: "a", body: "b", entity: "Order Table" }).success, false)
  assert.equal(openTicketInputSchema.safeParse({ subject: "a", body: "b", entity: "order", entityId: "o-1" }).success, true)
})

test("messages: es and en have the same keys and the same ICU arguments", () => {
  const leaves = (o: unknown, p = ""): [string, string][] =>
    Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === "string" ? [[p + k, v] as [string, string]] : leaves(v, `${p}${k}.`)
    )
  const args = (s: string) => [...s.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]).sort().join(",")
  const a = leaves(es)
  const b = new Map(leaves(en))
  assert.deepEqual(a.map(([k]) => k).sort(), [...b.keys()].sort())
  for (const [k, v] of a) {
    assert.ok(v.length > 0 && b.get(k)!.length > 0, k)
    assert.equal(args(v), args(b.get(k)!), k)
  }
  assert.deepEqual(Object.keys(es), ["tickets"])
  for (const s of TICKET_STATUSES) assert.ok(s in es.tickets.statuses && s in es.tickets.moves, s)
})

test("permissions: member can create and read, not manage; manage opens /admin", () => {
  assert.deepEqual(permissions.statement, { ticket: ["create", "read", "manage"] })
  assert.deepEqual(permissions.grants.member, { ticket: ["create", "read"] })
  assert.deepEqual(permissions.adminAccess, { ticket: ["manage"] })
})

test("source: staff notices go by permission, not by a fixed role list", () => {
  const src = read("server/notify.ts")
  assert.match(src, /notifyPermission\(\s*\{ resource: "ticket", action: "manage" \}/)
  assert.match(src, /excludeUserIds: \[args\.authorId\]/)
  assert.doesNotMatch(src, /"owner"|"admin"/)
})

test("nav: the inbox is an admin-area link guarded by ticket:manage", () => {
  const src = read("nav.ts")
  assert.match(src, /href: "\/admin\/tickets"[^}]*area: "admin"[^}]*permission: \{ ticket: \["manage"\] \}/)
  assert.ok("navAdmin" in es.tickets && "navAdmin" in en.tickets)
})

test("manifest: tables, migration, routes and entrypoints match the files", () => {
  const m = JSON.parse(read("manifest.json"))
  assert.equal(m.id, "tickets")
  assert.deepEqual(m.dependsOn, ["notifications"])
  assert.deepEqual(m.migrations, ["0118_tickets_init"])
  const sql = read("db/migrations/0118_tickets_init.ts")
  for (const table of m.tables) assert.match(sql, new RegExp(`create table ${table} \\(`), table)
  for (const r of m.routes) assert.doesNotThrow(() => read(r.entry), r.entry)
  for (const f of Object.values(m.entrypoints) as string[]) assert.doesNotThrow(() => read(f), f)
  assert.deepEqual(m.routes.map((r: { path: string }) => r.path), ["/tickets", "/tickets/[id]", "/admin/tickets"])
})

test("every Server Action checks session + permission before writing", () => {
  const src = read("server/actions.ts")
  assert.match(src, /^"use server"/)
  const parts = src.split(/export async function /).slice(1)
  assert.equal(parts.length, 3)
  for (const p of parts) {
    const guard = p.indexOf("actionSession(")
    const write = p.search(/(createTicketWith|addMessageWith|changeStatusWith)\(/)
    assert.ok(guard > -1 && write > guard, p.slice(0, 40))
    assert.match(p, /safeParse\(/)
  }
})

test("source: state changes lock the row and re-apply the domain rules; pages check permission", () => {
  const store = read("server/store.ts")
  assert.equal((store.match(/\.forUpdate\(\)/g) ?? []).length, 2)
  assert.match(store, /planReply\(/)
  assert.match(store, /planStatusChange\(/)
  assert.doesNotMatch(store, /sql`/)
  assert.match(read("ui/admin-page.tsx"), /requirePagePermission\([^)]*"manage"\)/)
  assert.match(read("ui/page.tsx"), /requirePagePermission\([^)]*"read"\)/)
  assert.match(read("ui/detail-page.tsx"), /canView\(/)
})

test("migration: no foreign key on user ids, messages cascade with the ticket", () => {
  const sql = read("db/migrations/0118_tickets_init.ts")
  assert.doesNotMatch(sql, /references "user"/)
  assert.match(sql, /references tickets\(id\) on delete cascade/)
})
