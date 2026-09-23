/**
 * VENDORED from AllFlow's Forge — `src/lib/scaffolding/forge.ts` in the
 * allflow.biz repo (P4, as of 23/09/2026). Do not edit here: if Forge's
 * contract changes, copy the new version over.
 *
 * What is copied, verbatim in behaviour: `SentinelConfig`,
 * `parseSentinelConfig()`, `validateAnswers()`, and the two sentinel passes of
 * `render()` (1 · replace only inside the whitelist, 6 · no leftovers). What
 * is left out: overlays, the package.json merge, `.env.example` assembly and
 * `allflow.template.json` — they don't depend on this template's files, and
 * they pull in the rest of allflow.biz (GitHub client, saga, stack router).
 * The one simplification: `db` is checked against the four catalogue values
 * inline instead of importing DATABASES from stack-router.ts.
 *
 * Why vendor instead of importing: this repo is public and standalone (D7);
 * it can't depend on AllFlow's private code at build or CI time.
 */

export const DATABASES = ["neon-postgres", "supabase-postgres", "mongodb-atlas", "firebase-firestore"] as const
export type Database = (typeof DATABASES)[number]

export type ForgeAnswers = {
  appName: string
  appTitle: string
  domain: string
  brandH: number
  brandC: number
  db: Database
}
export type AnswerKey = keyof ForgeAnswers
const ANSWER_KEYS: readonly AnswerKey[] = ["appName", "appTitle", "domain", "brandH", "brandC", "db"]

export type SentinelConfig = { version: 1; sentinels: SentinelSpec[] }
export type SentinelSpec = { literal: string; value: string; files: string[] }

export type RenderIssueCode =
  | "invalid_answers"
  | "invalid_sentinels"
  | "sentinel_outside_whitelist"
  | "sentinel_leftover"
export type RenderIssue = { code: RenderIssueCode; message: string; path?: string }
export type RenderResult = { ok: true; files: Map<string, string> } | { ok: false; issues: RenderIssue[] }

export const SENTINELS_FILE = "allflow.sentinels.json"

const PLACEHOLDER = /\{\{\s*([A-Za-z]+)\s*\}\}/g

export function parseSentinelConfig(
  raw: string
): { ok: true; config: SentinelConfig } | { ok: false; issues: RenderIssue[] } {
  const bad = (message: string): { ok: false; issues: RenderIssue[] } => ({
    ok: false,
    issues: [{ code: "invalid_sentinels", message, path: SENTINELS_FILE }],
  })
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch (err) {
    return bad(`${SENTINELS_FILE} no es JSON válido: ${(err as Error).message}`)
  }
  const obj = json as { version?: unknown; sentinels?: unknown }
  if (!obj || typeof obj !== "object" || obj.version !== 1 || !Array.isArray(obj.sentinels)) {
    return bad(`${SENTINELS_FILE} debe ser { "version": 1, "sentinels": [...] }.`)
  }
  const sentinels: SentinelSpec[] = []
  for (const [i, s] of (obj.sentinels as unknown[]).entries()) {
    const spec = s as Partial<SentinelSpec>
    if (
      !spec ||
      typeof spec.literal !== "string" ||
      typeof spec.value !== "string" ||
      !Array.isArray(spec.files) ||
      !spec.files.every((f) => typeof f === "string")
    ) {
      return bad(`sentinels[${i}] debe tener literal, value (strings) y files (string[]).`)
    }
    sentinels.push({ literal: spec.literal, value: spec.value, files: spec.files })
  }
  const issues = checkSentinelConfig({ version: 1, sentinels })
  return issues.length ? { ok: false, issues } : { ok: true, config: { version: 1, sentinels } }
}

function checkSentinelConfig(config: SentinelConfig): RenderIssue[] {
  const issues: RenderIssue[] = []
  const push = (message: string) => issues.push({ code: "invalid_sentinels", message, path: SENTINELS_FILE })
  const seen = new Set<string>()
  for (const s of config.sentinels) {
    if (!s.literal) push("Un centinela tiene literal vacío.")
    if (seen.has(s.literal)) push(`Centinela duplicado: "${s.literal}".`)
    seen.add(s.literal)
    for (const m of s.value.matchAll(PLACEHOLDER)) {
      if (!ANSWER_KEYS.includes(m[1] as AnswerKey)) push(`"${s.literal}" usa {{${m[1]}}}, que no es una answer.`)
    }
    if (s.files.length === 0) push(`"${s.literal}" no tiene archivos en su lista blanca.`)
  }
  return issues
}

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
const UNSAFE_TITLE = /["'`\\<>${}\u0000-\u001f\u007f]/

export function validateAnswers(a: ForgeAnswers): RenderIssue[] {
  const issues: RenderIssue[] = []
  const push = (message: string) => issues.push({ code: "invalid_answers", message })
  if (!SLUG.test(a.appName)) push(`appName "${a.appName}" debe ser un slug: minúsculas, dígitos y guiones.`)
  if (!a.appTitle.trim() || a.appTitle.length > 80) push("appTitle debe tener entre 1 y 80 caracteres.")
  if (UNSAFE_TITLE.test(a.appTitle))
    push("appTitle no puede contener comillas, backslash, <, >, $, llaves ni caracteres de control.")
  if (!HOSTNAME.test(a.domain)) push(`domain "${a.domain}" debe ser un hostname sin esquema (ej. miapp.cl).`)
  if (!Number.isFinite(a.brandH) || a.brandH < 0 || a.brandH >= 360) push("brandH debe estar en [0, 360).")
  if (!Number.isFinite(a.brandC) || a.brandC < 0 || a.brandC > 0.4) push("brandC debe estar en [0, 0.4].")
  if (!(DATABASES as readonly string[]).includes(a.db)) push(`db "${a.db}" no está en el catálogo.`)
  return issues
}

export function fillValue(template: string, a: ForgeAnswers): string {
  return template.replace(PLACEHOLDER, (_, key: string) => String(a[key as AnswerKey]))
}

/** render()'s sentinel passes (1 and 6 in Forge), nothing else. */
export function renderSentinels(files: Map<string, string>, sentinels: SentinelConfig, answers: ForgeAnswers): RenderResult {
  const early = [...validateAnswers(answers), ...checkSentinelConfig(sentinels)]
  if (early.length) return { ok: false, issues: early }

  const issues: RenderIssue[] = []
  const specs = [...sentinels.sentinels].sort((x, y) => y.literal.length - x.literal.length)
  const exempt = (path: string) => path === SENTINELS_FILE
  const out = new Map<string, string>()

  for (const [path, content] of files) {
    let text = content
    if (!exempt(path)) {
      for (const s of specs) {
        if (!text.includes(s.literal)) continue
        if (!s.files.includes(path)) {
          issues.push({
            code: "sentinel_outside_whitelist",
            path,
            message: `"${s.literal}" aparece en ${path}, que no está en su lista blanca.`,
          })
          continue
        }
        text = text.split(s.literal).join(fillValue(s.value, answers))
      }
    }
    out.set(path, text)
  }

  for (const [path, text] of out) {
    if (exempt(path)) continue
    for (const s of specs) {
      if (fillValue(s.value, answers).includes(s.literal)) continue
      if (text.includes(s.literal)) {
        if (issues.some((i) => i.code === "sentinel_outside_whitelist" && i.path === path)) continue
        issues.push({
          code: "sentinel_leftover",
          path,
          message: `Quedó el centinela "${s.literal}" en ${path} después del render.`,
        })
      }
    }
  }

  if (issues.length) return { ok: false, issues }
  return { ok: true, files: out }
}
