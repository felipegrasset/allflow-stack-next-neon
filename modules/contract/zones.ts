/**
 * Which files a change may not touch. Pure: `scripts/modules.ts guard` feeds
 * it the list of files a branch changed (git diff against the base).
 *
 * Two lists, two rules:
 *  - PROTECTED_ZONES (CONVENTIONS.md §1): AllFlow merges its template updates
 *    over them. Nobody edits them except an update PR labelled
 *    `zonas-protegidas-ok` (CI sets ALLOW_PROTECTED_ZONES=1 for that label).
 *  - ANCHOR_FILES: files the genesis edits with exact-text anchors
 *    (allflow.biz `genesis.ts`, `GENESIS_TREE_PATHS`) or rewrites. A module
 *    that edits one breaks the next generated app, so a change that adds or
 *    edits a module may not touch them. A change to the contract itself
 *    (modules/contract/**) is the one place they may change, and CODEOWNERS
 *    requires review there.
 */

export const PROTECTED_ZONES = ["components/ui/", "server/auth/"] as const

export const ANCHOR_FILES = [
  "server/db/migrate.ts",
  "server/db/schema/index.ts",
  "server/db/seed.ts",
  "config/nav.ts",
  "lib/permissions.ts",
] as const

export type Violation = {
  file: string
  rule: "protected-zone" | "anchor-file"
  message: string
}

export type GuardOptions = {
  /** Set by CI for a PR that carries the `zonas-protegidas-ok` label. */
  allowProtectedZones?: boolean
}

const CONTRACT_DIR = "modules/contract/"
/** modules/_generated/** is rewritten by `modules:sync`; touching it is part of installing a module. */
const isModuleChange = (f: string) =>
  f.startsWith("modules/") &&
  !f.startsWith(CONTRACT_DIR) &&
  f !== "modules/README.md"

export function findViolations(
  changed: readonly string[],
  opts: GuardOptions = {}
): Violation[] {
  const out: Violation[] = []
  const files = changed.map((f) => f.replace(/\\/g, "/"))

  if (!opts.allowProtectedZones) {
    for (const file of files) {
      const zone = PROTECTED_ZONES.find((z) => file.startsWith(z))
      if (zone) {
        out.push({
          file,
          rule: "protected-zone",
          message: `${file} está en ${zone} (zona de solo lectura, CONVENTIONS.md §1). Se compone encima, no se edita.`,
        })
      }
    }
  }

  const touchesModule = files.some(isModuleChange)
  const touchesContract = files.some((f) => f.startsWith(CONTRACT_DIR))
  if (touchesModule && !touchesContract) {
    for (const file of files) {
      if ((ANCHOR_FILES as readonly string[]).includes(file)) {
        out.push({
          file,
          rule: "anchor-file",
          message: `${file} es un archivo ancla de la génesis: un módulo no lo edita. Regístrate con el manifiesto y corre \`pnpm modules:sync\`.`,
        })
      }
    }
  }
  return out
}
