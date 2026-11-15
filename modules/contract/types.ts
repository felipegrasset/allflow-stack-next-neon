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
  /**
   * Entities of the app's domain this module already models (hole H6). Lower
   * case, singular, with the Spanish and English synonyms the analyst may see
   * in a spec: `["producto", "product", "categoría", "category"]`. The
   * platform reads it: an entity a module covers is NOT generated again by the
   * genesis. Two installed modules may not cover the same entity.
   */
  covers?: string[]
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
    /**
     * Exports `es` (the source catalog, `as const`) and `en`
     * (`WidenMessages<typeof es>`): plain object literals whose only top-level
     * key is the module id. Data only — no runtime imports. Sync merges them
     * into `modules/_generated/messages.ts`; the i18n module serves them.
     */
    messages?: string
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

/**
 * Where a module link shows:
 *  - `main` (default): the shell's header navigation (components/app-shell.tsx).
 *  - `settings`: the tabs of /settings (app/(app)/settings/layout.tsx), for pages under /settings/….
 *  - `admin`: the menu of /admin (app/(app)/admin/layout.tsx), for pages under /admin/….
 */
export type ModuleNavArea = "main" | "settings" | "admin"
export const MODULE_NAV_AREAS = ["main", "settings", "admin"] as const satisfies readonly ModuleNavArea[]

export type ModuleNavItem = {
  href: string
  /** A catalog key (`"<id>.nav"`) or a literal; the shell translates keys. */
  label: string
  /** Shown only to owner/admin, unless `permission` says who else sees it. */
  adminOnly?: boolean
  /** Default `main`. */
  area?: ModuleNavArea
  /**
   * Shown to whoever holds ALL of these permissions (Better Auth
   * `hasPermission`: static roles plus the dynamic "organizationRole" ones).
   * Owner/admin always see it. Visibility only: the page checks again.
   * In the `main` area the shell does not evaluate permissions yet, so a main
   * link with `permission` is shown to admins only (fails closed).
   */
  permission?: ModuleStatement
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
  /**
   * Permissions of `statement` that open the /admin area: anyone holding ANY
   * ONE of these `resource:action` pairs gets past app/(app)/admin/layout.tsx
   * (owner/admin always do). Each admin page still checks its own permission.
   * `modules:sync` lists them in `_generated/permissions.ts` (`moduleAdminAccess`)
   * and `tsc` rejects a resource or action that is not in `statement`.
   */
  adminAccess?: ModuleStatement
}

/** `adminAccess` of a permissions literal, `{}` when it declares none. */
export type AdminAccessOf<P> = P extends { readonly adminAccess: infer A } ? A : {}

/**
 * Compiles only when `A` uses resources and actions of `S`. The generated
 * permissions registry instantiates it once per module (`_AdminAccessChecks`).
 */
export type CheckAdminAccess<
  S,
  A extends { readonly [R in keyof A]: R extends keyof S ? S[R] extends readonly (infer X)[] ? readonly X[] : never : never },
> = A

export type ModuleHeaderSlotProps = { user: Session["user"] }
/** A server component rendered in AppShell's header, before the theme toggle. */
export type ModuleHeaderSlot = (
  props: ModuleHeaderSlotProps
) => ReactNode | Promise<ReactNode>

export type ModuleSeed = (db: Kysely<Database>) => Promise<void>

/** Numbering reserved for modules; the core (and the genesis) use 0001–0099. */
export const MODULE_MIGRATION_MIN = 100

// ── Messages (i18n extension point) ─────────────────────────────────────────

/**
 * The locales a module's `messages` file must export, source first. Same list
 * as `LOCALES` of modules/i18n/contracts (tests/i18n.test.ts checks it): the
 * contract does not import a module, so it is repeated here.
 */
export const MODULE_MESSAGE_LOCALES = ["es", "en"] as const
export type ModuleLocale = (typeof MODULE_MESSAGE_LOCALES)[number]
/** The locale whose catalog defines the keys (and the ICU arguments). */
export const MODULE_MESSAGE_SOURCE_LOCALE = "es" satisfies ModuleLocale

/** A catalog: nested keys, string leaves (ICU messages). */
export type MessageTree = { readonly [key: string]: string | MessageTree }

/**
 * The type of every non-source catalog: the keys of `es`, plain `string`
 * leaves. `export const en: WidenMessages<typeof es> = { … }` makes a missing
 * key a type error.
 */
export type WidenMessages<T> = T extends string
  ? string
  : { -readonly [K in keyof T]: WidenMessages<T[K]> }

/** `E` when its only top-level key is `Id` and its leaves are strings; an explanatory type otherwise. */
export type ModuleCatalog<Id extends string, E> = E extends MessageTree
  ? [Exclude<keyof E, Id>] extends [never]
    ? [Id] extends [keyof E]
      ? E
      : { "messages: falta la clave de primer nivel (el id del módulo)": Id }
    : { "messages: la única clave de primer nivel es el id del módulo": Id }
  : { "messages: las hojas del catálogo son textos": never }

/**
 * What a module's `messages` entrypoint must export, checked by
 * `modules/_generated/messages.ts` (so `tsc` fails on a broken catalog even
 * when the module typed its own file loosely).
 */
export type ModuleMessagesFile<Id extends string, E> = {
  es: ModuleCatalog<Id, E>
} & { [L in Exclude<ModuleLocale, "es">]: WidenMessages<E> }
