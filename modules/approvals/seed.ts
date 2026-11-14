import { randomUUID } from "node:crypto"
import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import { defineFlow } from "./contracts/flow"
import { EXAMPLE_FLOWS } from "./flows"

/**
 * Saves the example flows if their key is free. Idempotent, and it never
 * overwrites a flow an app already edited. No requests are seeded: a request
 * points at a real record of the app, which this module cannot invent.
 */
export async function seed(db: Kysely<Database>): Promise<void> {
  for (const input of EXAMPLE_FLOWS) {
    const def = defineFlow(input)
    await db
      .insertInto("approvals_flows")
      .values({ id: randomUUID(), key: def.key, definition: JSON.stringify(def) })
      .onConflict((oc) => oc.column("key").doNothing())
      .execute()
  }
}
