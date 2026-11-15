/**
 * notifications · destinatarios por permiso — la mitad pura de
 * `listUsersWithPermission` / `notifyPermission` (server/recipients.ts), que
 * calca las reglas de `hasPermission` de Better Auth. Sin base de datos.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  memberHasRole,
  parseDynamicPermission,
  pickRecipients,
  recipientNotificationId,
  rolesGranting,
  splitMemberRoles,
} from "../server/recipients"

const staticRoles = {
  owner: { ticket: ["create", "read", "manage"] },
  admin: { ticket: ["create", "read", "manage"] },
  member: { ticket: ["create", "read"] },
}

test("roles estáticos: solo los que tienen la acción", () => {
  assert.deepEqual(rolesGranting({ resource: "ticket", action: "manage" }, staticRoles, []), ["admin", "owner"])
  assert.deepEqual(rolesGranting({ resource: "ticket", action: "read" }, staticRoles, []), ["admin", "member", "owner"])
  assert.deepEqual(rolesGranting({ resource: "audit", action: "read" }, staticRoles, []), [])
})

test("roles dinámicos: un rol propio cuenta, y una fila con el nombre de un rol estático se FUSIONA (no lo reemplaza)", () => {
  const rows = [
    { role: "soporte", permission: JSON.stringify({ ticket: ["manage"] }) },
    { role: "member", permission: JSON.stringify({ audit: ["read"] }) },
    { role: "admin", permission: JSON.stringify({ audit: ["read"] }) },
  ]
  assert.deepEqual(rolesGranting({ resource: "ticket", action: "manage" }, staticRoles, rows), ["admin", "owner", "soporte"])
  // member keeps ticket:read from the static role after the merge.
  assert.ok(rolesGranting({ resource: "ticket", action: "read" }, staticRoles, rows).includes("member"))
  assert.deepEqual(rolesGranting({ resource: "audit", action: "read" }, staticRoles, rows), ["admin", "member"])
})

test("roles dinámicos inválidos no otorgan nada (falla cerrada)", () => {
  for (const bad of ["no-json", "[]", "null", JSON.stringify({ ticket: "manage" }), JSON.stringify({ ticket: [1] })]) {
    assert.equal(parseDynamicPermission(bad), null, bad)
    assert.deepEqual(rolesGranting({ resource: "ticket", action: "manage" }, {}, [{ role: "x", permission: bad }]), [], bad)
  }
})

test("roles de un miembro: separados por coma, como Better Auth (sin recortar espacios)", () => {
  assert.deepEqual(splitMemberRoles("member,soporte"), ["member", "soporte"])
  assert.deepEqual(splitMemberRoles(""), [])
  assert.deepEqual(splitMemberRoles(null), [])
  const granting = new Set(["soporte"])
  assert.equal(memberHasRole("member,soporte", granting), true)
  assert.equal(memberHasRole("member, soporte", granting), false)
  assert.equal(memberHasRole("member", granting), false)
})

test("destinatarios: sin duplicados, sin los excluidos y con tope", () => {
  assert.deepEqual(pickRecipients(["a", "b", "a", "c", "d"], { limit: 2, exclude: ["b"] }), {
    userIds: ["a", "c"],
    truncated: true,
  })
  assert.deepEqual(pickRecipients(["a", "b"], { limit: 5 }), { userIds: ["a", "b"], truncated: false })
  assert.deepEqual(pickRecipients([], { limit: 1 }), { userIds: [], truncated: false })
})

test("idempotencia: una clave por destinatario", () => {
  assert.equal(recipientNotificationId("ticket-42", "u1"), "ticket-42:u1")
  assert.notEqual(recipientNotificationId("ticket-42", "u1"), recipientNotificationId("ticket-42", "u2"))
})
