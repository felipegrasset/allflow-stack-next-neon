import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import { copy } from "./copy"

/** Un aviso de bienvenida por usuario existente. Idempotente: el id lleva el del usuario. */
export async function seed(db: Kysely<Database>): Promise<void> {
  const users = await db.selectFrom("user").select("id").execute()
  if (users.length === 0) return
  await db
    .insertInto("notifications")
    .values(
      users.map((u) => ({
        id: `seed-welcome-${u.id}`,
        user_id: u.id,
        kind: "info" as const,
        title: copy.seed.title,
        body: copy.seed.body,
        href: "/notifications",
      }))
    )
    .onConflict((oc) => oc.column("id").doNothing())
    .execute()
}
