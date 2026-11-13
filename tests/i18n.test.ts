/**
 * The i18n module (T4): `pnpm test:i18n`.
 *
 *  1. Every locale has exactly the keys of the source locale (es), none empty.
 *  2. Every message takes the same ICU arguments in every locale, and parses.
 *  3. No visible literal text in app/ or modules/ (JSX text and text-bearing
 *     attributes/properties), except the files declared pending below.
 *  4. The locale negotiation and the Intl formatters behave.
 *
 * Each of these can fail: the scanner and the comparators are exported pure
 * functions that the last tests feed deliberately broken input.
 */
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import test from "node:test"

import { createTranslator } from "next-intl"
import ts from "typescript"

import { argNames } from "../modules/i18n/copy"
import {
  DEFAULT_LOCALE,
  LOCALES,
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelative,
  negotiateLocale,
} from "../modules/i18n/contracts"
import { messages } from "../modules/i18n/messages"

const ROOT = join(import.meta.dirname, "..")

// ── helpers ──────────────────────────────────────────────────────────────────

type Tree = { [k: string]: string | Tree }

export function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>()
  for (const [k, v] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === "string") out.set(path, v)
    else for (const [pk, pv] of flatten(v, path)) out.set(pk, pv)
  }
  return out
}

/** Keys that one catalog has and the other lacks, and keys with an empty string. */
export function compareCatalogs(source: Tree, other: Tree) {
  const a = flatten(source)
  const b = flatten(other)
  return {
    missing: [...a.keys()].filter((k) => !b.has(k)),
    extra: [...b.keys()].filter((k) => !a.has(k)),
    empty: [...b].filter(([, v]) => v.trim() === "").map(([k]) => k),
    argMismatch: [...a.keys()]
      .filter((k) => b.has(k))
      .filter(
        (k) =>
          argNames(a.get(k)!).slice().sort().join() !==
          argNames(b.get(k)!).slice().sort().join()
      ),
  }
}

// ── 1 · same keys ────────────────────────────────────────────────────────────

test("every locale has exactly the keys of es, none empty", () => {
  for (const locale of LOCALES) {
    const r = compareCatalogs(messages.es as Tree, messages[locale] as Tree)
    assert.deepEqual(r.missing, [], `${locale}: faltan claves`)
    assert.deepEqual(r.extra, [], `${locale}: sobran claves`)
    assert.deepEqual(r.empty, [], `${locale}: claves vacías`)
  }
})

// ── 2 · same arguments, valid ICU ────────────────────────────────────────────

test("every message takes the same arguments in every locale", () => {
  for (const locale of LOCALES) {
    assert.deepEqual(
      compareCatalogs(messages.es as Tree, messages[locale] as Tree)
        .argMismatch,
      [],
      locale
    )
  }
})

test("every message formats (valid ICU) in every locale", () => {
  for (const locale of LOCALES) {
    const t = createTranslator({
      locale,
      messages: messages[locale] as never,
    }) as unknown as (
      key: string,
      values?: Record<string, string | number>
    ) => string
    for (const [key, text] of flatten(messages[locale] as Tree)) {
      const values = Object.fromEntries(argNames(text).map((n) => [n, 2]))
      const out = t(key, values)
      assert.ok(out.length > 0, `${locale}:${key} quedó vacío`)
      assert.ok(
        !/[{}]/.test(out),
        `${locale}:${key} dejó una llave sin resolver: ${out}`
      )
    }
  }
})

// ── 3 · no literal text in app/ or modules/ ──────────────────────────────────

/**
 * Declared PENDING (CONVENTIONS.md §2b, modules/i18n/MODULE.md): not hidden,
 * listed. Each entry says why it is still literal.
 */
export const PENDING_LITERALS: Record<string, string> = {
  "app/dev/": "galería de desarrollo (/dev/home-gallery): no llega al usuario",
  "modules/_examples/":
    "módulo de ejemplo del contrato: no se instala en las apps",
  "modules/kits-galeria":
    "galería de kits: catálogo de demostración, igual que los kits (espera el punto de extensión `messages`)",
  "modules/kit-":
    "kits de UI (T17): texto de demostración y valores por defecto que cada app reemplaza por props; el contrato aún no tiene punto de extensión `messages`",
  "modules/landing":
    "bloques y plantillas de landing (T9/T10): el texto vive en copy.ts, que la génesis reescribe por app; su catálogo i18n espera el punto de extensión `messages` del contrato",
  "modules/notifications/copy.ts":
    "copy de notificaciones en español: falta el punto de extensión `messages` del contrato (pendiente documentado en el PR de T4)",
}

const TEXT_ATTRS = new Set([
  "title",
  "aria-label",
  "aria-description",
  "placeholder",
  "alt",
  "label",
  "description",
])
const TEXT_PROPS = new Set([
  "title",
  "description",
  "label",
  "message",
  "placeholder",
  "alt",
])
const hasWords = (s: string) => /[A-Za-zÀ-ÿ]{2,}/.test(s)

/** Visible literals of one source file: JSX text, text attributes, text-bearing object properties. */
export function findLiterals(file: string, source: string): string[] {
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const hits: string[] = []
  const at = (n: ts.Node) =>
    sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n) && hasWords(n.text))
      hits.push(`${file}:${at(n)} texto JSX «${n.text.trim()}»`)
    if (
      ts.isJsxAttribute(n) &&
      TEXT_ATTRS.has(n.name.getText()) &&
      n.initializer &&
      ts.isStringLiteral(n.initializer) &&
      hasWords(n.initializer.text)
    ) {
      hits.push(
        `${file}:${at(n)} atributo ${n.name.getText()}="${n.initializer.text}"`
      )
    }
    if (
      ts.isPropertyAssignment(n) &&
      TEXT_PROPS.has(n.name.getText()) &&
      (ts.isStringLiteral(n.initializer) ||
        ts.isNoSubstitutionTemplateLiteral(n.initializer)) &&
      /\s/.test(n.initializer.text.trim()) &&
      hasWords(n.initializer.text)
    ) {
      hits.push(
        `${file}:${at(n)} propiedad ${n.name.getText()}: "${n.initializer.text}"`
      )
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return hits
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const SCANNED = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "modules"))]
  .map((p) => relative(ROOT, p).replace(/\\/g, "/"))
  .filter((p) => !/^modules\/(contract|_generated|_template)\//.test(p))
  .filter((p) => !p.startsWith("modules/i18n/messages/"))
  .filter((p) => !/\/db\/(migrations|types)/.test(p))
  .filter(
    (p) => !Object.keys(PENDING_LITERALS).some((prefix) => p.startsWith(prefix))
  )

test("the scan covers the app and the installed modules", () => {
  assert.ok(SCANNED.length > 40, `solo ${SCANNED.length} archivos escaneados`)
  assert.ok(SCANNED.includes("app/layout.tsx"))
  assert.ok(SCANNED.includes("modules/i18n/ui/language-selector.tsx"))
})

test("no visible literal text in app/ or modules/ (outside the declared pending)", () => {
  const hits = SCANNED.flatMap((p) =>
    findLiterals(p, readFileSync(join(ROOT, p), "utf8"))
  )
  assert.deepEqual(hits, [])
})

// ── the checks can fail ──────────────────────────────────────────────────────

test("the key comparison detects a missing key, an extra one, an empty one and an argument mismatch", () => {
  const es: Tree = { a: { b: "Hola, {name}", c: "x" } }
  assert.deepEqual(compareCatalogs(es, { a: { b: "Hi, {name}" } }).missing, [
    "a.c",
  ])
  assert.deepEqual(
    compareCatalogs(es, { a: { b: "Hi, {name}", c: "x", d: "y" } }).extra,
    ["a.d"]
  )
  assert.deepEqual(compareCatalogs(es, { a: { b: "Hi", c: " " } }).empty, [
    "a.c",
  ])
  assert.deepEqual(
    compareCatalogs(es, { a: { b: "Hi, {nombre}", c: "x" } }).argMismatch,
    ["a.b"]
  )
  assert.deepEqual(compareCatalogs(es, { a: { b: "Hi, {name}", c: "x" } }), {
    missing: [],
    extra: [],
    empty: [],
    argMismatch: [],
  })
})

test("the literal scanner finds JSX text, attributes and text properties — and ignores keys and code", () => {
  const bad = `export const A = () => <button aria-label="Cerrar">Guardar {x}</button>
const t = { title: "Perfil actualizado", href: "/x" }`
  assert.equal(findLiterals("a.tsx", bad).length, 3)
  const ok = `export const A = () => <button aria-label={c.close}>{c.save} · {x}</button>
const t = { title: copy.saved, label: "x", href: "/x" }`
  assert.deepEqual(findLiterals("a.tsx", ok), [])
})

// ── 4 · negotiation and formatters ───────────────────────────────────────────

test("negotiateLocale honours q-values, regions and falls back to null", () => {
  assert.equal(negotiateLocale("en-US,en;q=0.9,es;q=0.8"), "en")
  assert.equal(negotiateLocale("fr-FR,es-CL;q=0.5"), "es")
  assert.equal(negotiateLocale("es;q=0.2,en;q=0.9"), "en")
  assert.equal(negotiateLocale("fr,de;q=0.5"), null)
  assert.equal(negotiateLocale("en;q=0"), null)
  assert.equal(negotiateLocale(null), null)
  assert.equal(DEFAULT_LOCALE, "es")
})

test("the formatters follow the locale (Intl)", () => {
  assert.equal(formatCurrency(1990, "CLP", "es").replace(/\s/g, ""), "$1.990")
  assert.equal(formatCurrency(1990, "USD", "en"), "$1,990.00")
  assert.equal(formatNumber(1234.5, "es"), "1.234,5")
  assert.equal(formatNumber(1234.5, "en"), "1,234.5")
  assert.match(formatDate("2026-11-10T12:00:00Z", "es", "medium", "UTC"), /10/)
  assert.notEqual(
    formatDate("2026-11-10T12:00:00Z", "es", "long", "UTC"),
    formatDate("2026-11-10T12:00:00Z", "en", "long", "UTC")
  )
  assert.equal(formatRelative(-3, "day", "en"), "3 days ago")
  assert.equal(formatRelative(-3, "day", "es"), "hace 3 días")
})
