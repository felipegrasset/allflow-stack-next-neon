/** Database side. Kysely only; `db` is injected. */
import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import "../db/types"
import type { Recipient } from "./deliver"

type Db = Kysely<Database>

/** No row = enabled. */
export async function isEnabledWith(db: Db, userId: string): Promise<boolean> {
  const row = await db
    .selectFrom("notifications_email_prefs")
    .select("enabled")
    .where("user_id", "=", userId)
    .executeTakeFirst()
  return row ? row.enabled : true
}

export async function setEnabledWith(db: Db, userId: string, enabled: boolean): Promise<void> {
  await db
    .insertInto("notifications_email_prefs")
    .values({ user_id: userId, enabled })
    .onConflict((oc) => oc.column("user_id").doUpdateSet({ enabled, updated_at: new Date() }))
    .execute()
}

export async function getRecipientWith(db: Db, userId: string): Promise<Recipient | null> {
  const row = await db
    .selectFrom("user")
    .leftJoin("notifications_email_prefs as p", "p.user_id", "user.id")
    .select(["user.email", "user.locale", "p.enabled"])
    .where("user.id", "=", userId)
    .executeTakeFirst()
  if (!row) return null
  return { email: row.email, locale: row.locale, enabled: row.enabled ?? true }
}
