import type { Kysely } from "kysely"

import type { Database } from "@/server/db/schema"

import "./db/types"

/**
 * Invented sample data (companies, people and amounts are fictitious).
 * Idempotent: fixed ids + `on conflict do nothing`, so re-running never
 * duplicates nor overwrites what the team edited.
 */
const CONTACTS = [
  { id: "seed-crm-c1", name: "Valentina Soto", email: "valentina@aromosdelsur.example", phone: "+56 9 5555 0101", company: "Comercial Los Aromos", status: "customer" as const },
  { id: "seed-crm-c2", name: "Matías Fuentes", email: "matias@ferreteriaelfaro.example", phone: "+56 9 5555 0102", company: "Ferretería El Faro", status: "lead" as const },
  { id: "seed-crm-c3", name: "Camila Reyes", email: "camila@estudiocauce.example", phone: null, company: "Estudio Cauce", status: "lead" as const },
  { id: "seed-crm-c4", name: "Diego Paredes", email: null, phone: "+56 9 5555 0104", company: "Transportes Paredes", status: "lead" as const },
]

const DEALS = [
  { id: "seed-crm-d1", contact_id: "seed-crm-c1", name: "Renovación anual de soporte", amount_minor: 2400000, currency: "CLP", stage: "won" as const, closed: true },
  { id: "seed-crm-d2", contact_id: "seed-crm-c2", name: "Catálogo en línea", amount_minor: 1800000, currency: "CLP", stage: "proposal" as const, closed: false },
  { id: "seed-crm-d3", contact_id: "seed-crm-c3", name: "Rediseño de marca", amount_minor: 450000, currency: "USD", stage: "qualified" as const, closed: false },
  { id: "seed-crm-d4", contact_id: "seed-crm-c4", name: "Sistema de despachos", amount_minor: 5200000, currency: "CLP", stage: "new" as const, closed: false },
  { id: "seed-crm-d5", contact_id: "seed-crm-c2", name: "Capacitación del equipo", amount_minor: 600000, currency: "CLP", stage: "negotiation" as const, closed: false },
]

const ACTIVITIES = [
  { id: "seed-crm-a1", contact_id: "seed-crm-c2", deal_id: "seed-crm-d2", kind: "call" as const, body: "Revisamos el alcance; quiere pagar con transferencia." },
  { id: "seed-crm-a2", contact_id: "seed-crm-c3", deal_id: null, kind: "meeting" as const, body: "Primera reunión en su oficina. Envían el brief el viernes." },
  { id: "seed-crm-a3", contact_id: "seed-crm-c1", deal_id: "seed-crm-d1", kind: "note" as const, body: "Firmó la renovación por doce meses." },
]

export async function seed(db: Kysely<Database>): Promise<void> {
  await db
    .insertInto("crm_lite_contacts")
    .values(CONTACTS)
    .onConflict((oc) => oc.doNothing())
    .execute()
  await db
    .insertInto("crm_lite_deals")
    .values(
      DEALS.map(({ closed, ...d }) => ({
        ...d,
        closed_at: closed ? new Date() : null,
      }))
    )
    .onConflict((oc) => oc.doNothing())
    .execute()
  await db
    .insertInto("crm_lite_activities")
    .values(ACTIVITIES)
    .onConflict((oc) => oc.doNothing())
    .execute()
}
