import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

/**
 * Demo history (invented people and records). Fixed ids starting with "seed-":
 * idempotent, and the only rows the append-only trigger lets you delete.
 */
export async function seed(db: Kysely<Database>): Promise<void> {
  const hour = 3_600_000
  const now = Date.now()
  const rows = [
    { n: 1, ago: 30, actor: "Camila Soto", action: "contact.create", entity: "contact", id: "demo-contact-1",
      diff: { name: { to: "Ferretería Los Aromos" }, email: { to: "compras@losaromos.example" } } },
    { n: 2, ago: 26, actor: "Camila Soto", action: "deal.create", entity: "deal", id: "demo-deal-1",
      diff: { amount: { to: 1_500_000 }, stage: { to: "new" } } },
    { n: 3, ago: 20, actor: "Tomás Vergara", action: "deal.update", entity: "deal", id: "demo-deal-1",
      diff: { stage: { from: "new", to: "negotiation" }, amount: { from: 1_500_000, to: 1_800_000 } } },
    { n: 4, ago: 8, actor: "Tomás Vergara", action: "user.update", entity: "user", id: "demo-user-7",
      diff: { password: { from: "[redacted]", to: "[redacted]" }, role: { from: "member", to: "admin" } } },
    { n: 5, ago: 2, actor: null, action: "contact.delete", entity: "contact", id: "demo-contact-9",
      diff: { name: { from: "Cliente duplicado" } } },
  ]
  for (const r of rows) {
    await db
      .insertInto("audit_log")
      .values({
        id: `seed-audit-${String(r.n).padStart(4, "0")}`,
        actor_id: r.actor ? `seed-user-${r.actor.split(" ")[0].toLowerCase()}` : null,
        actor_name: r.actor,
        action: r.action,
        entity: r.entity,
        entity_id: r.id,
        diff: JSON.stringify(r.diff),
        created_at: new Date(now - r.ago * hour),
      })
      .onConflict((oc) => oc.column("id").doNothing())
      .execute()
  }
}
