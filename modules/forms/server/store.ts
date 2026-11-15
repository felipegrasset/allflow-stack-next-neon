import { randomUUID } from "node:crypto"

import { getKysely } from "@/server/db/pool"

import type { Answers } from "../contracts/answers"
import { formDefinitionSchema, type FormDefinition } from "../contracts/definition"
import type { FormRecord, FormStatus, ResponseRecord } from "../contracts/types"

/** How many answers the results page aggregates (newest first). */
export const SUMMARY_SCAN_LIMIT = 5000
/** How many recent responses the results page lists. */
export const RECENT_LIMIT = 50

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "23505"
}

/** Stored jsonb is validated again on the way out: a bad row throws instead of rendering garbage. */
function parseDefinition(json: unknown): FormDefinition {
  return formDefinitionSchema.parse(json)
}

/** Answers are plain JSON written by this module; anything that is not an object is treated as empty. */
function parseAnswers(json: unknown): Answers {
  return typeof json === "object" && json !== null && !Array.isArray(json) ? (json as Answers) : {}
}

type FormRow = {
  id: string
  slug: string
  title: string
  status: FormStatus
  one_per_person: boolean
  definition: unknown
  created_at: Date
}

function toRecord(row: FormRow): FormRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    onePerPerson: row.one_per_person,
    definition: parseDefinition(row.definition),
    createdAt: row.created_at,
  }
}

const COLUMNS = ["id", "slug", "title", "status", "one_per_person", "definition", "created_at"] as const

export async function listForms(): Promise<(FormRecord & { responseCount: number })[]> {
  const rows = await getKysely()
    .selectFrom("forms_forms as f")
    .select(COLUMNS.map((c) => `f.${c}` as const))
    .select((eb) =>
      eb
        .selectFrom("forms_responses as r")
        .select((e) => e.fn.countAll<string>().as("n"))
        .whereRef("r.form_id", "=", "f.id")
        .as("response_count")
    )
    .orderBy("f.created_at", "desc")
    .limit(200)
    .execute()
  return rows.map((r) => ({ ...toRecord(r), responseCount: Number(r.response_count ?? 0) }))
}

export async function getFormById(id: string): Promise<FormRecord | null> {
  const row = await getKysely().selectFrom("forms_forms").select(COLUMNS).where("id", "=", id).executeTakeFirst()
  return row ? toRecord(row) : null
}

export async function getFormBySlug(slug: string): Promise<FormRecord | null> {
  const row = await getKysely().selectFrom("forms_forms").select(COLUMNS).where("slug", "=", slug).executeTakeFirst()
  return row ? toRecord(row) : null
}

export async function insertForm(input: {
  slug: string
  definition: FormDefinition
  onePerPerson: boolean
  status: FormStatus
  createdBy: string | null
  id?: string
}): Promise<{ id: string; slug: string }> {
  const id = input.id ?? randomUUID()
  await getKysely()
    .insertInto("forms_forms")
    .values({
      id,
      slug: input.slug,
      title: titleOf(input.definition),
      status: input.status,
      one_per_person: input.onePerPerson,
      definition: JSON.stringify(input.definition),
      created_by: input.createdBy,
    })
    .execute()
  return { id, slug: input.slug }
}

/** The listing title: the Spanish text (source language) of the definition. */
export function titleOf(def: FormDefinition): string {
  return typeof def.title === "string" ? def.title : def.title.es
}

export async function setFormStatus(id: string, status: FormStatus): Promise<boolean> {
  const r = await getKysely()
    .updateTable("forms_forms")
    .set({ status, updated_at: new Date() })
    .where("id", "=", id)
    .executeTakeFirst()
  return Number(r.numUpdatedRows) > 0
}

export async function deleteForm(id: string): Promise<boolean> {
  const r = await getKysely().deleteFrom("forms_forms").where("id", "=", id).executeTakeFirst()
  return Number(r.numDeletedRows) > 0
}

export async function insertResponse(input: {
  formId: string
  answers: Answers
  respondentKey: string | null
  locale: string
}): Promise<string> {
  const id = randomUUID()
  await getKysely()
    .insertInto("forms_responses")
    .values({
      id,
      form_id: input.formId,
      answers: JSON.stringify(input.answers),
      respondent_key: input.respondentKey,
      locale: input.locale,
    })
    .execute()
  return id
}

export async function countResponses(formId: string): Promise<number> {
  const r = await getKysely()
    .selectFrom("forms_responses")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("form_id", "=", formId)
    .executeTakeFirst()
  return Number(r?.n ?? 0)
}

/** Newest first. */
export async function listResponses(formId: string, limit: number): Promise<ResponseRecord[]> {
  const rows = await getKysely()
    .selectFrom("forms_responses")
    .select(["id", "answers", "created_at"])
    .where("form_id", "=", formId)
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(limit)
    .execute()
  return rows.map((r) => ({ id: r.id, answers: parseAnswers(r.answers), createdAt: r.created_at }))
}
