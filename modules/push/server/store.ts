/**
 * Every query of the module (Kysely, no concatenated SQL). The database is an
 * argument so a test can pass its own.
 */
import { sql, type Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import type { StoredSubscription } from "./send"

type Db = Kysely<Database>

/**
 * Saves the browser's subscription for `userId`. The endpoint is unique: the
 * same browser subscribing again updates its keys and, if another person had
 * signed in on that browser before, moves the row to the current one (the
 * device now belongs to whoever is signed in there).
 */
export async function upsertSubscription(
  db: Db,
  input: { userId: string; endpoint: string; p256dh: string; auth: string }
): Promise<void> {
  await db
    .insertInto("push_subscriptions")
    .values({
      id: crypto.randomUUID(),
      user_id: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
    })
    .onConflict((oc) =>
      oc.column("endpoint").doUpdateSet({
        user_id: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        failure_count: 0,
        updated_at: sql<Date>`now()`,
      })
    )
    .execute()
}

/** Deletes the subscription with this endpoint only if it belongs to `userId`. Returns rows deleted. */
export async function deleteOwnSubscription(db: Db, userId: string, endpoint: string): Promise<number> {
  const res = await db
    .deleteFrom("push_subscriptions")
    .where("user_id", "=", userId)
    .where("endpoint", "=", endpoint)
    .executeTakeFirst()
  return Number(res.numDeletedRows)
}

export async function listForUser(db: Db, userId: string): Promise<StoredSubscription[]> {
  return db
    .selectFrom("push_subscriptions")
    .select(["id", "endpoint", "p256dh", "auth"])
    .where("user_id", "=", userId)
    .orderBy("created_at")
    .execute()
}

export async function countForUser(db: Db, userId: string): Promise<number> {
  const row = await db
    .selectFrom("push_subscriptions")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("user_id", "=", userId)
    .executeTakeFirst()
  return Number(row?.n ?? 0)
}

export async function deleteByIds(db: Db, ids: string[]): Promise<void> {
  if (!ids.length) return
  await db.deleteFrom("push_subscriptions").where("id", "in", ids).execute()
}

export async function recordOutcome(db: Db, outcome: { ok: string[]; failed: string[] }): Promise<void> {
  if (outcome.ok.length)
    await db
      .updateTable("push_subscriptions")
      .set({ last_success_at: sql<Date>`now()`, failure_count: 0 })
      .where("id", "in", outcome.ok)
      .execute()
  if (outcome.failed.length)
    await db
      .updateTable("push_subscriptions")
      .set((eb) => ({ failure_count: eb("failure_count", "+", 1) }))
      .where("id", "in", outcome.failed)
      .execute()
}
