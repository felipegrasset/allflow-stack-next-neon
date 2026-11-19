/**
 * Can a module be taken out? (T1). Pure: `scripts/modules.ts can-remove <id>`
 * hands it the installed modules and prints the result. It only CHECKS and
 * plans — it deletes nothing and never touches the database. The procedure
 * itself is in modules/README.md («Desinstalar»).
 */
import type { ModuleManifest } from "./types"
import {
  moduleImports,
  parseManifest,
  shimPath,
  type ModuleIssue,
  type ModuleSource,
} from "./validate"

export type RemovalBlocker = {
  /** The module that still needs `id`. */
  module: string
  reason: string
}

export type RemovalPlan = {
  id: string
  /** False when the module is not installed (nothing else is filled). */
  installed: boolean
  /** Who still depends on it. Empty = it can be taken out. */
  blockers: RemovalBlocker[]
  /** Migrations to revert, newest first (the order `down` must run in). */
  revert: string[]
  /** Tables those `down`s drop — their data is lost. */
  tables: string[]
  /** Shims `modules:sync` deletes from app/. */
  shims: string[]
  env: string[]
  dependencies: string[]
  /** Entities the platform will generate again once the module is gone. */
  covers: string[]
}

export function planRemoval(
  mods: readonly ModuleSource[],
  id: string
): RemovalPlan {
  const sink: ModuleIssue[] = []
  const parsed = mods.flatMap((src) => {
    const m = parseManifest(src.dir, src.manifest, sink)
    return m ? [{ src, m }] : []
  })
  const target = parsed.find((p) => p.m.id === id)
  const empty: RemovalPlan = {
    id,
    installed: false,
    blockers: [],
    revert: [],
    tables: [],
    shims: [],
    env: [],
    dependencies: [],
    covers: [],
  }
  if (!target) return empty
  const m: ModuleManifest = target.m

  const blockers: RemovalBlocker[] = []
  for (const { src, m: other } of parsed) {
    if (other.id === id) continue
    if (other.dependsOn?.includes(id))
      blockers.push({
        module: other.id,
        reason: `lo declara en dependsOn`,
      })
    const files = new Set(
      moduleImports(other.id, src.files)
        .filter((imp) => imp.target.split("/")[0] === id)
        .map((imp) => imp.file)
    )
    if (files.size)
      blockers.push({
        module: other.id,
        reason: `lo importa en ${[...files].sort().join(", ")}`,
      })
  }

  return {
    ...empty,
    installed: true,
    blockers,
    revert: [...(m.migrations ?? [])].sort().reverse(),
    tables: [...(m.tables ?? [])],
    shims: (m.routes ?? []).map(shimPath),
    env: (m.env ?? []).map((e) => e.key),
    dependencies: Object.keys(m.dependencies ?? {}),
    covers: [...(m.covers ?? [])],
  }
}
