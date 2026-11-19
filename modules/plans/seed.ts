import { randomUUID } from "node:crypto"
import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import type { EntitlementKind } from "./contracts/domain"
import "./db/types"

/**
 * A free default plan and two paid EXAMPLES born as drafts. Nothing sellable
 * comes out of the seed: the paid ones have no `plan_ref` and are not
 * published, so they are never offered until someone creates the plan in the
 * provider, pastes its id and publishes it on /admin/plans.
 *
 * Idempotent: a plan whose key exists is left as is (an app may have edited
 * it), and so is an entitlement whose (plan, key) exists. `gratis` becomes the
 * default ONLY if there is no default yet.
 */
type SeedEntitlement = {
  key: string
  kind: EntitlementKind
  enabled?: boolean
  limit?: number | null
  es: string
  en: string
}

type SeedPlan = {
  key: string
  nameEs: string
  nameEn: string
  descriptionEs: string
  descriptionEn: string
  /** Always `null` here: real provider ids are pasted on /admin/plans. */
  planRef: null
  /** Always `false` here: nothing is sold until someone publishes it. */
  published: false
  isDefault: boolean
  sort: number
  entitlements: SeedEntitlement[]
}

const PROJECTS = { key: "projects", kind: "limit", es: "Proyectos", en: "Projects" } as const
const MEMBERS = { key: "members", kind: "limit", es: "Miembros del equipo", en: "Team members" } as const
const EXPORT = { key: "export", kind: "feature", es: "Exportar a CSV", en: "CSV export" } as const
const SUPPORT = { key: "priority_support", kind: "feature", es: "Soporte prioritario", en: "Priority support" } as const

export const EXAMPLE_PLANS: SeedPlan[] = [
  {
    key: "gratis",
    nameEs: "Gratis",
    nameEn: "Free",
    descriptionEs: "Para probar la app con un proyecto.",
    descriptionEn: "To try the app with one project.",
    planRef: null,
    published: false,
    isDefault: true,
    sort: 0,
    entitlements: [
      { ...PROJECTS, limit: 1 },
      { ...MEMBERS, limit: 1 },
      { ...EXPORT, enabled: false },
      { ...SUPPORT, enabled: false },
    ],
  },
  {
    key: "pro",
    nameEs: "Pro",
    nameEn: "Pro",
    descriptionEs: "Para una persona que trabaja con varios clientes.",
    descriptionEn: "For one person working with several clients.",
    planRef: null,
    published: false,
    isDefault: false,
    sort: 10,
    entitlements: [
      { ...PROJECTS, limit: 20 },
      { ...MEMBERS, limit: 3 },
      { ...EXPORT, enabled: true },
      { ...SUPPORT, enabled: false },
    ],
  },
  {
    key: "equipo",
    nameEs: "Equipo",
    nameEn: "Team",
    descriptionEs: "Para equipos que necesitan espacio sin límites.",
    descriptionEn: "For teams that need room without limits.",
    planRef: null,
    published: false,
    isDefault: false,
    sort: 20,
    entitlements: [
      { ...PROJECTS, limit: null },
      { ...MEMBERS, limit: 25 },
      { ...EXPORT, enabled: true },
      { ...SUPPORT, enabled: true },
    ],
  },
]

export async function seed(db: Kysely<Database>): Promise<void> {
  const existingDefault = await db
    .selectFrom("plans_plans")
    .select("id")
    .where("is_default", "=", true)
    .executeTakeFirst()
  let defaultTaken = Boolean(existingDefault)

  for (const p of EXAMPLE_PLANS) {
    const makeDefault = p.isDefault && !defaultTaken
    await db
      .insertInto("plans_plans")
      .values({
        id: randomUUID(),
        key: p.key,
        name_es: p.nameEs,
        name_en: p.nameEn,
        description_es: p.descriptionEs,
        description_en: p.descriptionEn,
        plan_ref: p.planRef,
        published: p.published,
        is_default: makeDefault,
        sort: p.sort,
      })
      .onConflict((oc) => oc.column("key").doNothing())
      .execute()
    if (makeDefault) defaultTaken = true

    const plan = await db
      .selectFrom("plans_plans")
      .select("id")
      .where("key", "=", p.key)
      .executeTakeFirstOrThrow()
    for (const e of p.entitlements) {
      // Skip a key that already exists with another kind (an app's own choice).
      const clash = await db
        .selectFrom("plans_entitlements")
        .select("id")
        .where("key", "=", e.key)
        .where("kind", "!=", e.kind)
        .executeTakeFirst()
      if (clash) continue
      await db
        .insertInto("plans_entitlements")
        .values({
          id: randomUUID(),
          plan_id: plan.id,
          key: e.key,
          kind: e.kind,
          enabled: e.kind === "feature" ? e.enabled === true : false,
          limit_value: e.kind === "limit" ? (e.limit ?? null) : null,
          label_es: e.es,
          label_en: e.en,
        })
        .onConflict((oc) => oc.columns(["plan_id", "key"]).doNothing())
        .execute()
    }
  }
}
