/** The functions behind `contracts/`. Server-only. No permission checks: the caller decides. */
import { getKysely } from "@/server/db/pool"
import { getSession } from "@/server/session"

import { SettingError } from "../contracts/errors"
import { findDefinition, type SettingDefinition } from "../contracts/registry"
import { getWith, resetWith, setWith } from "./store"

function pick(ref: SettingDefinition | string): SettingDefinition {
  if (typeof ref !== "string") return ref
  const def = findDefinition(ref)
  if (!def) throw new SettingError("unknown_setting", `Setting "${ref}" is not defined in this process`)
  return def
}

/** The signed-in user id, or null outside a request (jobs, seeds). */
async function currentUserId(): Promise<string | null> {
  try {
    return (await getSession())?.user.id ?? null
  } catch {
    return null
  }
}

/** Current value (the stored one, else the default). A stored value that no longer passes the schema yields the default. */
export async function getSetting<T>(def: SettingDefinition<T>): Promise<T>
export async function getSetting(key: string): Promise<unknown>
export async function getSetting(ref: SettingDefinition | string): Promise<unknown> {
  return getWith(getKysely(), pick(ref))
}

/** Validates with the declared schema and saves. Throws `SettingError("invalid_value")`. */
export async function setSetting<T>(def: SettingDefinition<T>, value: T): Promise<T>
export async function setSetting(key: string, value: unknown): Promise<unknown>
export async function setSetting(ref: SettingDefinition | string, value: unknown): Promise<unknown> {
  return setWith(getKysely(), pick(ref), value, await currentUserId())
}

/** Back to the default (deletes the stored value). */
export async function resetSetting(ref: SettingDefinition | string): Promise<void> {
  await resetWith(getKysely(), pick(ref).key)
}
