/**
 * Lo automatizable de la rúbrica de un kit (T17). Puro: texto → hallazgos.
 * `tests/kit-core.test.ts` lo corre sobre TODA carpeta `modules/kit-*`, así que
 * un kit nuevo queda cubierto sin tocar nada. El contraste y el desborde a
 * 375 px se miden en el navegador: `testing/axe.ts`.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

export type KitFinding = { rule: KitRule; file: string; message: string }
export type KitRule =
  | "literal_color"
  | "palette_class"
  | "oklch_not_derived"
  | "font_not_allowed"
  | "no_core_import"
  | "doc_missing"
  | "rubric_missing"
  | "rubric_failed"

/** Las 9 familias abiertas permitidas (PLAN-TEMPLATES-FULVIA §5.3). Nombre de next/font. */
export const ALLOWED_FONT_IMPORTS = [
  "Geist",
  "Geist_Mono",
  "Inter",
  "Manrope",
  "Fraunces",
  "Plus_Jakarta_Sans",
  "Lexend",
  "IBM_Plex_Sans",
  "IBM_Plex_Mono",
  "Outfit",
] as const
const ALLOWED_FAMILY_NAMES = ALLOWED_FONT_IMPORTS.map((n) =>
  n.replace(/_/g, " ").toLowerCase()
)

const PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|shadow|accent|decoration|caret)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?(?:\/\d+)?\b/
const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|color)\(/
const HEX = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b/
const NAMED =
  /\b(?:color|background(?:-color)?|border(?:-color)?|fill|stroke|outline-color)\s*:\s*(?:white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|teal|navy|silver)\b/i

/** Contenido de cada llamada `oklch(...)`, con paréntesis anidados. */
function oklchCalls(text: string): string[] {
  const out: string[] = []
  let i = text.indexOf("oklch(")
  while (i !== -1) {
    let depth = 0
    let j = i + "oklch".length
    for (; j < text.length; j++) {
      if (text[j] === "(") depth++
      else if (text[j] === ")" && --depth === 0) break
    }
    out.push(text.slice(i + 6, j))
    i = text.indexOf("oklch(", j)
  }
  return out
}

function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
}

/**
 * Revisa los archivos de UN kit. `files`: ruta relativa al kit → texto.
 * `isCore` exime al núcleo de importarse a sí mismo y le permite declarar
 * los literales `oklch()` de sus tokens (siempre con la marca o un matiz fijo).
 */
export function checkKitFiles(
  id: string,
  files: Map<string, string>,
  isCore = false
): KitFinding[] {
  const out: KitFinding[] = []
  const add = (rule: KitRule, file: string, message: string) =>
    out.push({ rule, file, message })
  let importsCore = isCore

  for (const [rel, raw] of files) {
    if (!/\.(tsx?|css)$/.test(rel) || rel.startsWith("testing/")) continue
    const text = stripComments(raw)
    if (
      /@\/modules\/kit-core\/contracts/.test(text) ||
      /\.\.\/contracts/.test(text)
    )
      importsCore = true

    if (HEX.test(text))
      add(
        "literal_color",
        rel,
        "color hexadecimal: usa un token (bg-primary, var(--kit-tint)…)"
      )
    if (COLOR_FN.test(text))
      add("literal_color", rel, "color rgb()/hsl()/lab()…: usa un token")
    if (NAMED.test(text))
      add("literal_color", rel, "color con nombre (white, red…): usa un token")
    const palette = PALETTE.exec(text)
    if (palette)
      add(
        "palette_class",
        rel,
        `clase de paleta de Tailwind (${palette[0]}): usa los tokens del tema`
      )

    for (const call of oklchCalls(text)) {
      if (!/var\(--brand-h\)|var\(--kit-[a-z]+-h\)/.test(call))
        add(
          "oklch_not_derived",
          rel,
          `oklch(${call}) no deriva su matiz de --brand-h ni de un --kit-*-h`
        )
      if (rel.endsWith(".tsx"))
        add(
          "oklch_not_derived",
          rel,
          "oklch() en un .tsx: llévalo a un token en el CSS del kit"
        )
    }

    for (const m of text.matchAll(
      /import\s*\{([^}]*)\}\s*from\s*["']next\/font\/google["']/g
    )) {
      for (const name of m[1]
        .split(",")
        .map((s) => s.trim().split(/\s+as\s+/)[0])
        .filter(Boolean)) {
        if (!(ALLOWED_FONT_IMPORTS as readonly string[]).includes(name))
          add(
            "font_not_allowed",
            rel,
            `fuente ${name}: solo se permiten ${ALLOWED_FONT_IMPORTS.join(", ")}`
          )
      }
    }
    for (const m of text.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
      const decl = m[1].trim()
      if (/^var\(--font-[a-z-]+\)/.test(decl)) continue
      const first = decl.split(",")[0].replace(/["']/g, "").trim().toLowerCase()
      if (!ALLOWED_FAMILY_NAMES.includes(first))
        add(
          "font_not_allowed",
          rel,
          `font-family «${first}»: usa var(--font-heading|--font-sans|--font-mono) o una de las 9 abiertas`
        )
    }
  }
  if (!importsCore)
    add(
      "no_core_import",
      "(kit)",
      "el kit no importa @/modules/kit-core/contracts: sin núcleo no hay tokens ni estados"
    )
  return out
}

/** Lee `modules/<id>/` (sin node_modules) como mapa ruta → texto. */
export function readKitDir(root: string, id: string): Map<string, string> {
  const base = join(root, "modules", id)
  const map = new Map<string, string>()
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n)
      if (statSync(p).isDirectory()) walk(p)
      else map.set(relative(base, p), readFileSync(p, "utf8"))
    }
  }
  walk(base)
  return map
}

export const KIT_DOC_SECTIONS = [
  "## Referentes",
  "## Licencia y origen",
  "## Cómo se usa",
] as const

/** Documentación obligatoria de un kit: MODULE.md con las tres secciones, y la rúbrica puntuada. */
export function checkKitDocs(
  id: string,
  files: Map<string, string>,
  isCore = false
): KitFinding[] {
  const out: KitFinding[] = []
  const doc = files.get("MODULE.md") ?? ""
  for (const s of KIT_DOC_SECTIONS)
    if (!doc.includes(s))
      out.push({
        rule: "doc_missing",
        file: "MODULE.md",
        message: `falta la sección «${s}»`,
      })
  if (!isCore) {
    const r = files.get("rubrica.json")
    if (!r)
      out.push({
        rule: "rubric_missing",
        file: "rubrica.json",
        message: "falta rubrica.json (ver modules/kit-core/RUBRICA.md)",
      })
    else {
      try {
        const res = scoreKitRubric(JSON.parse(r))
        if (!res.passes)
          out.push({
            rule: "rubric_failed",
            file: "rubrica.json",
            message: res.reasons.join("; "),
          })
      } catch (e) {
        out.push({
          rule: "rubric_failed",
          file: "rubrica.json",
          message: `JSON inválido: ${(e as Error).message}`,
        })
      }
    }
  }
  return out
}

export function kitDirs(root: string): string[] {
  const dir = join(root, "modules")
  return existsSync(dir)
    ? readdirSync(dir)
        .filter(
          (n) =>
            /^kit-[a-z0-9-]+$/.test(n) && statSync(join(dir, n)).isDirectory()
        )
        .sort()
    : []
}

// ── Rúbrica ─────────────────────────────────────────────────────────────────

export const RUBRIC_POINTS = [
  "jerarquia",
  "espacio",
  "escala_tipografica",
  "imagen",
  "estados",
  "movil_primero",
  "contraste_aa",
  "coherencia_tema",
] as const
export type RubricPoint = (typeof RUBRIC_POINTS)[number]
export type RubricScores = Record<RubricPoint, 0 | 1 | 2>
export type KitRubric = {
  "1280": RubricScores
  "375": RubricScores
  revisado?: string
  notas?: string
}

export const RUBRIC_MIN_TOTAL = 13

/** 13 de 16 o más y ningún 0, a 1280 y a 375 px (cada ancho por separado). */
export function scoreKitRubric(r: unknown): {
  passes: boolean
  totals: Record<string, number>
  reasons: string[]
} {
  const reasons: string[] = []
  const totals: Record<string, number> = {}
  for (const w of ["1280", "375"] as const) {
    const s = (r as Record<string, Record<string, unknown>> | null)?.[w]
    if (!s || typeof s !== "object") {
      reasons.push(`falta la medición a ${w} px`)
      continue
    }
    let total = 0
    for (const p of RUBRIC_POINTS) {
      const v = s[p]
      if (v !== 0 && v !== 1 && v !== 2) {
        reasons.push(`${w} px: «${p}» debe ser 0, 1 o 2`)
        continue
      }
      if (v === 0)
        reasons.push(`${w} px: «${p}» tiene 0 (ningún punto puede ser 0)`)
      total += v
    }
    totals[w] = total
    if (total < RUBRIC_MIN_TOTAL)
      reasons.push(`${w} px: ${total}/16, se exigen ${RUBRIC_MIN_TOTAL}`)
  }
  return { passes: reasons.length === 0, totals, reasons }
}
