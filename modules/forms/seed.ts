import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import type { Answers } from "./contracts/answers"
import { defineForm } from "./contracts/definition"
import { satisfactionDefinition, workshopDefinition } from "./examples"
import { es } from "./messages"
import { titleOf } from "./server/store"

const SATISFACTION_ID = "seed-form-satisfaccion"
const WORKSHOP_ID = "seed-form-taller"

/**
 * Two example forms (open) and a handful of invented responses for the first
 * one, so the results page has something to show. Idempotent: fixed ids and
 * slugs, `on conflict do nothing`, so re-running never overwrites a form an
 * admin edited or duplicates a response. No emails or names of real people.
 */
export async function seed(db: Kysely<Database>): Promise<void> {
  const forms = [
    { id: SATISFACTION_ID, slug: "satisfaccion-demo", def: defineForm(satisfactionDefinition()) },
    { id: WORKSHOP_ID, slug: "taller-demo", def: defineForm(workshopDefinition()) },
  ]
  for (const f of forms) {
    await db
      .insertInto("forms_forms")
      .values({
        id: f.id,
        slug: f.slug,
        title: titleOf(f.def),
        status: "open",
        one_per_person: false,
        definition: JSON.stringify(f.def),
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  const s = es.forms.seed.satisfaction
  const answers: Answers[] = [
    { rating: 5, channel: "web", improve: ["speed"], comment: s.comment1 },
    { rating: 4, channel: "whatsapp", improve: ["clarity", "price"] },
    { rating: 3, channel: "phone", improve: ["speed", "clarity"], comment: s.comment2 },
    { rating: 5, channel: "whatsapp", comment: s.comment3 },
    { rating: 4, channel: "web", improve: ["price"] },
    { rating: 2, channel: "phone", improve: ["speed"], email: "ana.demo@example.com" },
  ]
  for (const [i, a] of answers.entries()) {
    await db
      .insertInto("forms_responses")
      .values({
        id: `seed-resp-satisfaccion-${i + 1}`,
        form_id: SATISFACTION_ID,
        answers: JSON.stringify(a),
        locale: "es",
        created_at: new Date(Date.UTC(2026, 10, 2 + i, 15, 0, 0)),
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
  }
}
