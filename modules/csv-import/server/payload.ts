/** Serializable shapes the Server Actions return to the client. Types only. */
import type { CellErrorCode, Mapping, RowError } from "../contracts/plan"

export type PreviewPayload =
  | {
      ok: true
      delimiter: string
      headers: string[]
      mapping: Mapping
      /** Required fields with no column (the plan is not computed). */
      missing: string[]
      totalRows: number
      validRows: number
      errorRows: number
      errors: RowError[]
      sample: { row: number; cells: Record<string, string> }[]
    }
  | { ok: false; error: string }

export type RunPayload =
  | { ok: true; imported: number; skipped: number }
  | { ok: false; error: string }

export type { CellErrorCode }
