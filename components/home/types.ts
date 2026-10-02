/**
 * Shared, entity-agnostic shapes for the home layouts. The genesis (or an
 * agent) queries the data and passes it in already formatted as strings, so
 * these components never know about concrete entities.
 */
export type HomeColumn = { key: string; label: string; align?: "left" | "right" }

export type HomeRow = {
  id: string
  /** Where clicking the row goes (detail page). */
  href?: string
  /** Display values keyed by HomeColumn.key, already formatted. */
  cells: Record<string, string>
}

export type HomeKpi = { label: string; value: string; hint?: string }

export type HomeEmpty = {
  title: string
  description?: string
  action?: { href: string; label: string }
}
