import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import { es } from "./messages"

/**
 * Two sample codes, made up: BIENVENIDA10 (10 %, one use per person) and
 * DESPACHO2000 (CLP 2.000 off from CLP 15.000, up to 100 uses). No uses: they
 * need real orders. Idempotent: fixed ids and codes, `on conflict do nothing`
 * (re-running never overwrites what an admin changed).
 */
export async function seed(db: Kysely<Database>): Promise<void> {
  const s = es.discounts.seed
  await db
    .insertInto("discounts_codes")
    .values([
      {
        id: "5d1c0a10-0000-4000-8000-000000000001",
        code: "BIENVENIDA10",
        kind: "percent",
        percent_bp: 1000,
        amount_minor: null,
        currency: null,
        min_subtotal_minor: null,
        max_uses: null,
        max_uses_per_user: 1,
        active: true,
        note: s.welcomeNote,
      },
      {
        id: "5d1c0a10-0000-4000-8000-000000000002",
        code: "DESPACHO2000",
        kind: "fixed",
        percent_bp: null,
        amount_minor: 2000,
        currency: "CLP",
        min_subtotal_minor: 15000,
        max_uses: 100,
        max_uses_per_user: null,
        active: true,
        note: s.shippingNote,
      },
    ])
    .onConflict((oc) => oc.doNothing())
    .execute()
}
