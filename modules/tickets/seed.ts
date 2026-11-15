import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import "./db/types"

/**
 * Two example tickets (one with a staff reply) for the first user, with fixed
 * ids so running it again does nothing. No users yet → nothing to seed.
 * Invented data.
 */
export async function seed(db: Kysely<Database>): Promise<void> {
  const user = await db.selectFrom("user").select("id").orderBy("createdAt", "asc").limit(1).executeTakeFirst()
  if (!user) return
  const day = 24 * 3600 * 1000
  const t0 = Date.now()
  const tickets = [
    { id: "tickets-seed-1", subject: "No me llega el correo de confirmación", status: "in_progress", priority: "normal", at: t0 - 2 * day },
    { id: "tickets-seed-2", subject: "¿Puedo cambiar el nombre de mi cuenta?", status: "open", priority: "low", at: t0 - day },
  ]
  for (const t of tickets) {
    await db
      .insertInto("tickets")
      .values({
        id: t.id,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        requester_id: user.id,
        created_at: new Date(t.at),
        updated_at: new Date(t.at + 3600 * 1000),
      })
      .onConflict((oc) => oc.column("id").doNothing())
      .execute()
  }
  const messages = [
    { id: "tickets-seed-1-m1", ticket_id: "tickets-seed-1", author_kind: "requester", body: "Me registré hace dos días y no recibí el correo para confirmar mi cuenta. Revisé spam.", at: t0 - 2 * day },
    { id: "tickets-seed-1-m2", ticket_id: "tickets-seed-1", author_kind: "staff", body: "Hola, ya revisamos tu cuenta y reenviamos el correo. ¿Te llegó?", at: t0 - 2 * day + 3600 * 1000 },
    { id: "tickets-seed-2-m1", ticket_id: "tickets-seed-2", author_kind: "requester", body: "Quisiera cambiar el nombre con el que aparezco en la plataforma. ¿Se puede?", at: t0 - day },
  ]
  for (const m of messages) {
    await db
      .insertInto("tickets_messages")
      .values({
        id: m.id,
        ticket_id: m.ticket_id,
        author_id: user.id,
        author_kind: m.author_kind,
        body: m.body,
        created_at: new Date(m.at),
      })
      .onConflict((oc) => oc.column("id").doNothing())
      .execute()
  }
}
