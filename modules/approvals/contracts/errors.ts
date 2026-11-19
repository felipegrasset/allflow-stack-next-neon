/**
 * Every failure of the approvals module is an `ApprovalError` with a stable
 * `code`. An invalid transition is always an error, never a silent no-op.
 * Pure: no runtime imports, so other modules and the tests can use it freely.
 */
export const APPROVAL_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "invalid_input",
  "invalid_flow",
  "flow_not_found",
  "flow_inactive",
  "request_not_found",
  "already_open",
  "invalid_transition",
  "self_approval",
  "comment_required",
  "conflict",
] as const

export type ApprovalErrorCode = (typeof APPROVAL_ERROR_CODES)[number]

export class ApprovalError extends Error {
  readonly code: ApprovalErrorCode

  constructor(code: ApprovalErrorCode, message?: string) {
    super(message ?? code)
    this.name = "ApprovalError"
    this.code = code
  }
}

export function isApprovalError(e: unknown): e is ApprovalError {
  return e instanceof ApprovalError
}
