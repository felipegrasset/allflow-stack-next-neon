/**
 * Every failure of the forms module is a `FormError` with a stable `code`.
 * Pure: no runtime imports.
 */
export const FORM_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "invalid_input",
  "invalid_definition",
  "not_found",
  "slug_taken",
  "closed",
  "login_required",
  "already_responded",
  "rate_limited",
] as const

export type FormErrorCode = (typeof FORM_ERROR_CODES)[number]

export class FormError extends Error {
  readonly code: FormErrorCode

  constructor(code: FormErrorCode, message?: string) {
    super(message ?? code)
    this.name = "FormError"
    this.code = code
  }
}

export function isFormError(e: unknown): e is FormError {
  return e instanceof FormError
}
