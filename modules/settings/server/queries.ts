import { getKysely } from "@/server/db/pool"

import "../db/types"
import { listDefinitions, resolveValue, toRaw, type SettingEditor } from "../contracts/registry"
import { localize } from "../contracts/registry"
import "../definitions"

export type SettingRow = {
  key: string
  group: string
  label: string
  description: string | null
  editor: SettingEditor
  options: readonly string[] | null
  raw: string
  defaultRaw: string
  source: "stored" | "default" | "invalid"
  updatedAt: Date | null
  updatedByName: string | null
}

export type OrphanRow = { key: string; raw: string; updatedAt: Date }

/** Every registered setting with its effective value, plus stored keys nobody defines in this process. */
export async function listAdminSettings(locale: string): Promise<{ rows: SettingRow[]; orphans: OrphanRow[] }> {
  const stored = await getKysely()
    .selectFrom("settings as s")
    .leftJoin("user as u", "u.id", "s.updated_by")
    .select(["s.key", "s.value", "s.updated_at", "u.name as updated_by_name"])
    .execute()
  const byKey = new Map(stored.map((r) => [r.key, r]))
  const defs = listDefinitions()
  const rows = defs.map((def): SettingRow => {
    const row = byKey.get(def.key)
    const r = resolveValue(def, row ? row.value : undefined)
    return {
      key: def.key,
      group: def.group,
      label: localize(def.label, locale),
      description: def.description ? localize(def.description, locale) : null,
      editor: def.editor,
      options: def.options ?? null,
      raw: toRaw(def, r.value),
      defaultRaw: toRaw(def, def.default),
      source: r.source,
      updatedAt: row?.updated_at ?? null,
      updatedByName: row?.updated_by_name ?? null,
    }
  })
  const known = new Set(defs.map((d) => d.key))
  const orphans = stored
    .filter((r) => !known.has(r.key))
    .map((r) => ({ key: r.key, raw: JSON.stringify(r.value) ?? "", updatedAt: r.updated_at }))
  return { rows, orphans }
}
