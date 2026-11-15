import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import "./db/types"

/**
 * Two example comments on a demo record, for the first user, with fixed ids so
 * running it again does nothing. No users yet → nothing to seed. Invented data.
 */
export async function seed(db: Kysely<Database>): Promise<void> {
  const user = await db.selectFrom("user").select("id").orderBy("createdAt", "asc").limit(1).executeTakeFirst()
  if (!user) return
  const t0 = Date.now()
  const rows = [
    { id: "comments-seed-1", body: "Dejé listo el borrador. ¿Alguien puede revisarlo antes del viernes?", at: t0 - 3600 * 1000 * 5 },
    { id: "comments-seed-2", body: "Lo reviso mañana a primera hora y te cuento.", at: t0 - 3600 * 1000 * 2 },
  ]
  for (const r of rows)
    await db
      .insertInto("comments")
      .values({ id: r.id, entity: "demo", entity_id: "comments-seed-record", author_id: user.id, body: r.body, created_at: new Date(r.at) })
      .onConflict((oc) => oc.column("id").doNothing())
      .execute()
}
