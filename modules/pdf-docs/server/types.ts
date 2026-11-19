/** Declarative document model of `pdf-docs`. Pure types: safe to import anywhere. */

export type Rgb = readonly [number, number, number] // each channel 0..1
export type PageSize = "A4" | "letter"
export type Align = "left" | "center" | "right"

export type PdfBlock =
  /** Big document title with an optional subtitle and an accent rule. */
  | { type: "title"; text: string; subtitle?: string }
  /** Section heading. */
  | { type: "heading"; text: string }
  /** Wrapped text. `\n` forces a line break. */
  | { type: "paragraph"; text: string; bold?: boolean; size?: number; align?: Align; muted?: boolean }
  /** Label : value rows; the value wraps in its column. */
  | { type: "keyValue"; rows: readonly { label: string; value: string }[]; labelWidth?: number }
  /** Table with a header row (repeated on every page) and wrapped cells. `width` is a relative weight. */
  | {
      type: "table"
      columns: readonly { header: string; width?: number; align?: Align }[]
      rows: readonly (readonly string[])[]
    }
  | { type: "divider" }
  | { type: "spacer"; height?: number }
  /** Signature lines side by side (up to 3 per row). */
  | { type: "signature"; signers: readonly { name: string; role?: string }[] }

export type PdfDefinition = {
  title?: string
  author?: string
  subject?: string
  /** Default "A4". */
  pageSize?: PageSize
  /** Points, 36..120. Default 50. */
  margin?: number
  /** Accent colour (rules, headings, table header). Default a dark blue. */
  accent?: Rgb
  /** Small line at the top of every page. */
  header?: { left?: string; right?: string }
  /**
   * Bottom of every page. `pageLabel` uses `{page}` and `{total}`
   * (default "Página {page} de {total}"). `false` = no footer at all.
   */
  footer?: { text?: string; pageLabel?: string } | false
  blocks: readonly PdfBlock[]
  /** Written to the info dictionary only when given (keeps output deterministic). */
  createdAt?: Date
}
