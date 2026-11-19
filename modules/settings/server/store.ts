/** Database access with the Kysely instance injected, so it is easy to fake. */
import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import "../db/types"
import { SettingError } from "../contracts/errors"
import { resolveValue, validateValue, type Resolved, type SettingDefinition } from "../contracts/registry"

/** The stored value, or undefined when the key has no row. */
export async function readStoredWith(db: Kysely<Database>, key: string): Promise<unknown | undefined> {
  const row = await db.selectFrom("settings").select("value").where("key", "=", key).executeTakeFirst()
  return row ? row.value : undefined
}

export async function getWith<T>(db: Kysely<Database>, def: SettingDefinition<T>): Promise<T> {
  return resolveValue(def, await readStoredWith(db, def.key)).value
}

export async function resolveWith<T>(db: Kysely<Database>, def: SettingDefinition<T>): Promise<Resolved<T>> {
  return resolveValue(def, await readStoredWith(db, def.key))
}

/** Validates, then upserts. Returns the validated value. */
export async function setWith<T>(
  db: Kysely<Database>,
  def: SettingDefinition<T>,
  value: unknown,
  userId: string | null
): Promise<T> {
  const valid = validateValue(def, value)
  const json = JSON.stringify(valid)
  if (json === undefined) throw new SettingError("invalid_value", `"${def.key}" is not serializable`)
  const now = new Date()
  await db
    .insertInto("settings")
    .values({ key: def.key, value: json, updated_by: userId, updated_at: now })
    .onConflict((oc) => oc.column("key").doUpdateSet({ value: json, updated_by: userId, updated_at: now }))
    .execute()
  return valid
}

/** Deletes the row: the setting goes back to its default. */
export async function resetWith(db: Kysely<Database>, key: string): Promise<void> {
  await db.deleteFrom("settings").where("key", "=", key).execute()
}
