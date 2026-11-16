/**
 * Logging allow-list: the operation and the error's NAME and code, never its
 * message or stack (a database error can carry codes, amounts or ids).
 */
export function safeLog(operation: string, err: unknown): void {
  const name = err instanceof Error ? err.name : typeof err
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code).slice(0, 40)
      : undefined
  console.error(`[discounts] ${operation} failed`, { name, code })
}
