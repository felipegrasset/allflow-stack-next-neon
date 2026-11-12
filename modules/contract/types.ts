/**
 * The module contract (T1). A "module" is a self-contained folder
 * `modules/<id>/` that an agent installs without editing any anchor file of
 * the genesis. Read MODULE-CONTRACT.md (modules/README.md) first.
 *
 * Types only: nothing here runs at request time. `pnpm modules:sync` turns the
 * manifests into `modules/_generated/*.ts`, which is what the app imports.
 */
import type { Kysely } from "kysely"
import type { ReactNode } from "react"

import type { Session } from "@/server/auth"
import type { Database } from "@/server/db/schema"

/** `env` entry of a manifest — same shape as Forge's `OverlayEnvVar`. */
export type ModuleEnvVar = {
  key: string
  description: string
  example?: string
}

/**
 * `manifest.json`. The first block mirrors Forge's `OverlayManifestEntry`
 * (allflow.biz `src/lib/scaffolding/forge.ts`) field for field, so the saga can
 * hand it to Forge unchanged. The second block is what Forge has no field for.
 * `files` is deliberately absent: the installed form of a module is its whole
 * folder, and the validator checks that nothing else is needed.
 */
export type ModuleManifest = {
  schema: 1

  // ── Same shape as Forge's OverlayManifestEntry ────────────────────────────
  /** A value of FEATURES in stack-router.ts, or the module id for kits/blocks with no router feature. */
  feature: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  env?: ModuleEnvVar[]
  /** Ids of other modules that must be installed. Their migrations sort before this one's. */
  dependsOn?: string[]

  // ── Fulvia module contract ────────────────────────────────────────────────
  /** kebab-case; equals the folder name. */
  id: string
  /** semver. */
  version: string
  title: string
  description: string
  /** Tables the module creates. Each is `<id_with_underscores>` or starts with `<id_with_underscores>_`. */
  tables?: string[]
  /** Migration names, `NNNN_<name>` with NNNN >= 0100, file at `db/migrations/<name>.ts`. */
  migrations?: string[]
  /** Pages the module adds. Sync writes a one-line shim under `app/` for each. */
  routes?: ModuleRoute[]
  /** Files (relative to the module folder) the app imports, by role. */
  entrypoints?: {
    /** exports `nav: ModuleNavItem[]` */
    nav?: string
    /** exports `permissions: ModulePermissions` */
    permissions?: string
    /** default-exports a `ModuleHeaderSlot` */
    header?: string
    /** exports `seed(db)` — idempotent */
    seed?: string
  }
}

export type ModuleRoute = {
  /** URL path, e.g. "/notifications" or "/orders/[id]". */
  path: string
  /**
   * Page file inside the module, default-exporting the page (e.g. "ui/page.tsx"),
   * or — when the file is named `route.ts` — a Next route handler exporting its
   * HTTP verbs (e.g. "server/webhook/route.ts"). A handler's shim lands at
   * `app/<path>/route.ts`, with no route group (webhooks, provider callbacks).
   */
  entry: string
  /** Route group the shim lands in. `app` = signed-in shell (default), `marketing` = public. */
  group?: "app" | "marketing"
}

export type ModuleNavItem = {
  href: string
  label: string
  adminOnly?: boolean
}

/** Resource → actions, as Better Auth's access control takes them. */
export type ModuleStatement = Record<string, readonly string[]>

export type ModulePermissions = {
  statement: ModuleStatement
  /** What each built-in role gets. owner and admin default to the whole `statement`; member to nothing. */
  grants?: {
    owner?: ModuleStatement
    admin?: ModuleStatement
    member?: ModuleStatement
  }
}

export type ModuleHeaderSlotProps = { user: Session["user"] }
/** A server component rendered in AppShell's header, before the theme toggle. */
export type ModuleHeaderSlot = (
  props: ModuleHeaderSlotProps
) => ReactNode | Promise<ReactNode>

export type ModuleSeed = (db: Kysely<Database>) => Promise<void>

/** Numbering reserved for modules; the core (and the genesis) use 0001–0099. */
export const MODULE_MIGRATION_MIN = 100
