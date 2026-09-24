/**
 * `aria-describedby` for a field: its description AND its error, space
 * separated, skipping the ones that aren't rendered (a11y rule 2 of
 * CONVENTIONS.md §"Formularios").
 *
 *   aria-describedby={describedBy("email-description", fieldState.invalid && "email-error")}
 */
export function describedBy(...ids: (string | false | null | undefined)[]): string | undefined {
  return ids.filter(Boolean).join(" ") || undefined
}
