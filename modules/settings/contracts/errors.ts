/**
 * Every failure of the settings module is a `SettingError` with a stable
 * `code`. Pure: no runtime imports.
 */
export const SETTING_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "invalid_key",
  "invalid_definition",
  "secret_key",
  "unknown_setting",
  "invalid_value",
] as const

export type SettingErrorCode = (typeof SETTING_ERROR_CODES)[number]

export class SettingError extends Error {
  readonly code: SettingErrorCode

  constructor(code: SettingErrorCode, message?: string) {
    super(message ?? code)
    this.name = "SettingError"
    this.code = code
  }
}

export function isSettingError(e: unknown): e is SettingError {
  return e instanceof SettingError
}
