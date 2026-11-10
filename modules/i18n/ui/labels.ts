import { es } from "../messages"

/** Spanish text → catalog key, for every plain-string leaf. */
const bySource = new Map<string, string>()
;(function walk(node: Record<string, unknown>, path: string) {
  for (const [k, v] of Object.entries(node)) {
    const p = path ? `${path}.${k}` : k
    if (typeof v === "string") {
      if (!v.includes("{") && !bySource.has(v)) bySource.set(v, p)
    } else walk(v as Record<string, unknown>, p)
  }
})(es, "")

/**
 * A nav label may be a catalog key (`"auth.shell.home"`, what a module should
 * write), or the Spanish text of one (what `config/nav.ts` holds, because the
 * genesis writes `authCopy.shell.home` there), or free text (an entity name the
 * genesis wrote in the app's language). Returns the key to translate, or null.
 */
export function labelKey(
  label: string,
  has: (key: string) => boolean
): string | null {
  if (has(label)) return label
  const key = bySource.get(label)
  return key && has(key) ? key : null
}
