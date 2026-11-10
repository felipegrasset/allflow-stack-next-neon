import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

export async function seed(db: Kysely<Database>): Promise<void> {
  await db
    .insertInto("ping_pings")
    .values({ id: "seed-1", message: "hola desde el seed del módulo" })
    .onConflict((oc) => oc.column("id").doNothing())
    .execute()
}
