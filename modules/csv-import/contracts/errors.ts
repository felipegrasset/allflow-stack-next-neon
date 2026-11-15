/**
 * Every failure of the csv-import module is an `ImportError` with a stable
 * `code`. Pure: no runtime imports.
 */
export const IMPORT_ERROR_CODES = [
  // the file
  "empty",
  "no_rows",
  "too_large",
  "too_many_rows",
  "too_many_columns",
  "unterminated_quote",
  // the target and the mapping
  "invalid_target",
  "unknown_target",
  "invalid_mapping",
] as const

export type ImportErrorCode = (typeof IMPORT_ERROR_CODES)[number]

export class ImportError extends Error {
  readonly code: ImportErrorCode

  constructor(code: ImportErrorCode, message?: string) {
    super(message ?? code)
    this.name = "ImportError"
    this.code = code
  }
}

export function isImportError(e: unknown): e is ImportError {
  return e instanceof ImportError
}
