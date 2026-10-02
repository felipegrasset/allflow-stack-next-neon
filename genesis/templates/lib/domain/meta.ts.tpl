/**
 * Shapes and formatting shared by the generated domain screens (list, form,
 * detail). Copied verbatim by AllFlow's genesis (renderGenesis) from
 * `genesis/templates/lib/domain/meta.ts` to `lib/domain/meta.ts`; the
 * entity-specific data (field lists, labels, options) is generated, this file
 * is not.
 */

export type FieldType =
  | "text"
  | "longtext"
  | "number"
  | "money"
  | "date"
  | "datetime"
  | "boolean"
  | "enum"
  | "email"
  | "phone"
  | "url"
  | "image"
  | "relation"

export type Option = { value: string; label: string }

export type FieldMeta = {
  name: string
  label: string
  type: FieldType
  required: boolean
  /** Shown as a column in the list screen. */
  list: boolean
  /** enum: the allowed values with their labels. */
  options?: Option[]
}

/** What a form holds: every control is a string, except checkboxes. */
export type FormValues = Record<string, string | boolean>

/** One row as the queries return it: dates as text, money as number, relations with `<field>Label`. */
export type DomainRow = { id: string } & Record<string, unknown>

export type DomainCopy = {
  locale: string
  save: string
  saving: string
  saved: string
  cancel: string
  unsavedHint: string
  serverError: string
  select: string
  yes: string
  no: string
  search: string
  searchPlaceholder: string
  noResults: string
  previous: string
  next: string
  pageOf: (page: number, pages: number) => string
  delete: string
  deleting: string
  deleteConfirm: string
  deleteConfirmYes: string
  deleteFailedInUse: string
  approve: string
  approving: string
  actions: string
}

export const EMPTY_CELL = "—"

/** The text of one cell, formatted for the app's language. Dates arrive as `YYYY-MM-DD` / `YYYY-MM-DDTHH:mm` (UTC wall time). */
export function formatCell(field: FieldMeta, value: unknown, copy: Pick<DomainCopy, "locale" | "yes" | "no">): string {
  if (value === null || value === undefined || value === "") return EMPTY_CELL
  switch (field.type) {
    case "boolean":
      return value ? copy.yes : copy.no
    case "number":
      return new Intl.NumberFormat(copy.locale).format(Number(value))
    case "money":
      return new Intl.NumberFormat(copy.locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
        Number(value)
      )
    case "date": {
      const d = new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(copy.locale, { timeZone: "UTC" })
    }
    case "datetime": {
      const d = new Date(`${String(value).slice(0, 16)}:00Z`)
      return Number.isNaN(d.getTime())
        ? String(value)
        : d.toLocaleString(copy.locale, { timeZone: "UTC", dateStyle: "short", timeStyle: "short" })
    }
    case "enum":
      return field.options?.find((o) => o.value === value)?.label ?? String(value)
    default:
      return String(value)
  }
}
