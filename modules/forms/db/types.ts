import type { ColumnType } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>
/** jsonb: read back as parsed JSON (validated again with zod), written as a JSON string. */
type Json = ColumnType<unknown, string, string>

export type FormStatus = "draft" | "open" | "closed"

export interface FormsFormsTable {
  id: string
  slug: string
  title: string
  status: ColumnType<FormStatus, FormStatus | undefined, FormStatus>
  one_per_person: ColumnType<boolean, boolean | undefined, boolean>
  definition: Json
  created_by: ColumnType<string | null, string | null | undefined, string | null>
  created_at: Timestamp
  updated_at: Timestamp
}

export interface FormsResponsesTable {
  id: string
  form_id: string
  answers: Json
  respondent_key: ColumnType<string | null, string | null | undefined, string | null>
  locale: ColumnType<string | null, string | null | undefined, string | null>
  created_at: Timestamp
}

declare module "@/server/db/schema" {
  interface Database {
    forms_forms: FormsFormsTable
    forms_responses: FormsResponsesTable
  }
}
