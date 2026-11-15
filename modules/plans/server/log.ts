/**
 * Logging allow-list: the operation and the error's NAME and code, never its
 * message or stack (a provider or database error can carry personal data,
 * amounts or keys). Same spirit as payments' PAY-4.
 */
export function safeLog(operation: string, err: unknown): void {
  const name = err instanceof Error ? err.name : typeof err
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code).slice(0, 40)
      : undefined
  console.error(`[plans] ${operation} failed`, { name, code })
}
