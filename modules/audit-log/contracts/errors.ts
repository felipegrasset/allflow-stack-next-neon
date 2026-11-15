/** Failures of the audit-log module. Pure: no runtime imports. */
export const AUDIT_ERROR_CODES = ["unauthenticated", "invalid_input"] as const
export type AuditErrorCode = (typeof AUDIT_ERROR_CODES)[number]

export class AuditError extends Error {
  readonly code: AuditErrorCode

  constructor(code: AuditErrorCode, message?: string) {
    super(message ?? code)
    this.name = "AuditError"
    this.code = code
  }
}

export function isAuditError(e: unknown): e is AuditError {
  return e instanceof AuditError
}
