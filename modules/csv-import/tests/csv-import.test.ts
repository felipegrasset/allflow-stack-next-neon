/**
 * csv-import v0.1 — what runs WITHOUT a database: the CSV parser (quotes,
 * escaped quotes, line breaks inside a field, BOM, `;` and `,`, uneven rows,
 * empty file, limits), cell conversion, the mapping, the plan and preview, the
 * target registry, the store with a fake Kysely (batches, one transaction,
 * failure recorded), the catalog (es/en parity), permissions, the manifest
 * and, reading the code, the guards of the Server Actions.
 * Relative imports only, so it runs transpiled without the `@/` alias.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { z } from "zod"

import { isImportError } from "../contracts/errors"
import {
  CELL_ERROR_CODES,
  coerceCell,
  normalizeHeader,
  parseNumber,
  planImport,
  prepareImport,
  suggestMapping,
} from "../contracts/plan"
import { MAX_ROWS, detectDelimiter, parseCsv, parseRecords, stripBom } from "../contracts/parse"
import {
  IMPORT_BATCH_SIZE,
  clearImportTargets,
  findImportTarget,
  listImportTargets,
  localize,
  registerImportTarget,
  type ImportField,
  type ImportRow,
  type ImportTarget,
} from "../contracts/registry"
import { en, es } from "../messages"
import { permissions } from "../permissions"
import { chunk, runImportWith } from "../server/store"

const DIR = join(process.cwd(), "modules", "csv-import") // run from the template root
const read = (rel: string) => readFileSync(join(DIR, rel), "utf8")

function code(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (e) {
    return isImportError(e) ? e.code : "other"
  }
  return undefined
}

// ── parser ────────────────────────────────────────────────────────────

test("parseRecords: simple rows, with and without a final newline", () => {
  assert.deepEqual(parseRecords("a,b\n1,2", ","), [["a", "b"], ["1", "2"]])
  assert.deepEqual(parseRecords("a,b\n1,2\n", ","), [["a", "b"], ["1", "2"]])
  assert.deepEqual(parseRecords("a,b\r\n1,2\r\n", ","), [["a", "b"], ["1", "2"]])
  assert.deepEqual(parseRecords("a,b\r1,2\r", ","), [["a", "b"], ["1", "2"]])
})

test("parseRecords: quoted fields keep delimiters and spaces", () => {
  assert.deepEqual(parseRecords('"Pérez, Ana",  hola ,"x;y"', ","), [["Pérez, Ana", "  hola ", "x;y"]])
})

test("parseRecords: doubled quotes are one literal quote", () => {
  assert.deepEqual(parseRecords('"dijo ""hola""","""",""""""', ","), [['dijo "hola"', '"', '""']])
})

test("parseRecords: line breaks inside a quoted field stay in the field", () => {
  assert.deepEqual(parseRecords('a,b\n"línea 1\nlínea 2",x\n"c\r\nd",y', ","), [
    ["a", "b"],
    ["línea 1\nlínea 2", "x"],
    ["c\r\nd", "y"],
  ])
})

test("parseRecords: a quote in the middle of an unquoted field is literal", () => {
  assert.deepEqual(parseRecords('5" pantalla,ok', ","), [['5" pantalla', "ok"]])
})

test("parseRecords: text after a closing quote is kept (lenient)", () => {
  assert.deepEqual(parseRecords('"ab"cd,e', ","), [["abcd", "e"]])
})

test("parseRecords: empty fields, trailing delimiter and blank lines", () => {
  assert.deepEqual(parseRecords("a,,c\n,,\n\n   \nx,y,", ","), [["a", "", "c"], ["", "", ""], ["x", "y", ""]])
  assert.deepEqual(parseRecords("a,b\n\n\n1,2\n\n", ","), [["a", "b"], ["1", "2"]])
})

test("parseRecords: an unterminated quote is an error, not silent data loss", () => {
  assert.equal(code(() => parseRecords('a,"sin cerrar\nb,c', ",")), "unterminated_quote")
})

test("parseRecords: semicolon and tab delimiters; the comma is then plain text", () => {
  assert.deepEqual(parseRecords("a;b\n1,5;2", ";"), [["a", "b"], ["1,5", "2"]])
  assert.deepEqual(parseRecords("a\tb\n1\t2", "\t"), [["a", "b"], ["1", "2"]])
})

test("parseRecords: rows of uneven length are returned as they are", () => {
  assert.deepEqual(parseRecords("a,b,c\n1\n1,2,3,4", ","), [["a", "b", "c"], ["1"], ["1", "2", "3", "4"]])
})

test("parseRecords: column and row limits", () => {
  assert.equal(code(() => parseRecords("a,b,c,d", ",", { maxColumns: 3 })), "too_many_columns")
  assert.equal(parseRecords("a,b,c", ",", { maxColumns: 3 }).length, 1)
  const rows = (n: number) => ["h", ...Array.from({ length: n }, (_, i) => String(i))].join("\n")
  assert.equal(parseRecords(rows(5), ",", { maxRows: 5 }).length, 6)
  assert.equal(code(() => parseRecords(rows(6), ",", { maxRows: 5 })), "too_many_rows")
})

test("stripBom / detectDelimiter", () => {
  assert.equal(stripBom("﻿a,b"), "a,b")
  assert.equal(stripBom("a,b"), "a,b")
  assert.equal(detectDelimiter("a,b,c\n1,2,3"), ",")
  assert.equal(detectDelimiter("a;b;c\n1,5;2;3"), ";")
  assert.equal(detectDelimiter("a\tb\tc"), "\t")
  assert.equal(detectDelimiter("solo"), ",")
  assert.equal(detectDelimiter(""), ",")
  // delimiters inside quotes in the header do not count
  assert.equal(detectDelimiter('"a,b,c,d";e;f\n1;2;3'), ";")
  // only the first record decides
  assert.equal(detectDelimiter("a;b\n1,2,3,4,5"), ";")
  assert.equal(detectDelimiter("﻿a;b"), ";")
})

test("parseCsv: BOM, header trimming, delimiter detection", () => {
  const r = parseCsv("﻿ Nombre ;Correo\nAna;ana@ejemplo.cl\n")
  assert.equal(r.delimiter, ";")
  assert.deepEqual(r.headers, ["Nombre", "Correo"])
  assert.deepEqual(r.rows, [["Ana", "ana@ejemplo.cl"]])
})

test("parseCsv: a forced delimiter overrides detection", () => {
  const r = parseCsv("a;b,c\n1;2,3", { delimiter: "," })
  assert.deepEqual(r.headers, ["a;b", "c"])
})

test("parseCsv: empty file, whitespace only, header only", () => {
  assert.equal(code(() => parseCsv("")), "empty")
  assert.equal(code(() => parseCsv("   \n\r\n  ")), "empty")
  assert.equal(code(() => parseCsv("﻿")), "empty")
  assert.equal(code(() => parseCsv("a,b\n")), "no_rows")
  assert.equal(code(() => parseCsv("a,b\n\n\n")), "no_rows")
  assert.equal(code(() => parseCsv(undefined as unknown as string)), "empty")
})

test("parseCsv: size limit is in bytes, not characters", () => {
  assert.equal(code(() => parseCsv("a\n" + "x".repeat(20), { maxBytes: 10 })), "too_large")
  // 6 chars but 12 bytes
  assert.equal(code(() => parseCsv("ññññññ", { maxBytes: 8 })), "too_large")
  assert.equal(parseCsv("a\nb", { maxBytes: 3 }).rows.length, 1)
})

test("parseCsv: row limit counts data rows, not the header", () => {
  const body = Array.from({ length: MAX_ROWS }, (_, i) => `r${i}`).join("\n")
  assert.equal(parseCsv("h\n" + body).rows.length, MAX_ROWS)
  assert.equal(code(() => parseCsv("h\n" + body + "\nextra")), "too_many_rows")
})

test("parseCsv: a quoted multi-line field inside a realistic file", () => {
  const csv = 'nombre;nota\r\n"Ana ""la jefa""";"Primera línea\r\nsegunda línea"\r\nLuis;\r\n'
  const r = parseCsv(csv)
  assert.deepEqual(r.rows, [['Ana "la jefa"', "Primera línea\r\nsegunda línea"], ["Luis", ""]])
})

// ── numbers, cells ────────────────────────────────────────────────────

test("parseNumber: decimals and thousands separators", () => {
  const cases: [string, number | null][] = [
    ["12", 12],
    ["-12", -12],
    ["+7", 7],
    ["1234.5", 1234.5],
    ["1234,5", 1234.5],
    ["1.234,5", 1234.5],
    ["1,234.5", 1234.5],
    ["1.234.567", 1234567],
    ["1,234,567", 1234567],
    ["1.234", 1234],
    ["1,234", 1234],
    ["0.123", 0.123],
    ["0,5", 0.5],
    [" 1 234 ", 1234],
    ["1.2345", 1.2345],
    [".5", 0.5],
    ["", null],
    ["abc", null],
    ["1e5", null],
    ["--1", null],
    ["1.2.3", null],
    ["1,2,3", null],
    ["12.", null],
    [",", null],
    ["1.234,56,7", null],
  ]
  for (const [raw, want] of cases) assert.equal(parseNumber(raw), want, raw)
})

const f = (over: Partial<ImportField> & { key?: string } = {}): ImportField => ({ key: "x", label: "X", ...over })

test("coerceCell: empty cell → null, or `required` when the field is required", () => {
  assert.deepEqual(coerceCell(f(), "   "), { ok: true, value: null })
  assert.deepEqual(coerceCell(f({ required: true }), ""), { ok: false, code: "required" })
})

test("coerceCell: text is trimmed and length-limited", () => {
  assert.deepEqual(coerceCell(f(), "  hola "), { ok: true, value: "hola" })
  assert.deepEqual(coerceCell(f({ maxLength: 3 }), "abcd"), { ok: false, code: "too_long" })
  assert.deepEqual(coerceCell(f({ maxLength: 3 }), "abc"), { ok: true, value: "abc" })
  assert.deepEqual(coerceCell(f(), "x".repeat(501)), { ok: false, code: "too_long" })
})

test("coerceCell: email, number, integer", () => {
  assert.deepEqual(coerceCell(f({ type: "email" }), "ana@ejemplo.cl"), { ok: true, value: "ana@ejemplo.cl" })
  for (const bad of ["ana", "ana@", "@x.cl", "a b@x.cl", "ana@x"])
    assert.deepEqual(coerceCell(f({ type: "email" }), bad), { ok: false, code: "invalid_email" }, bad)
  assert.deepEqual(coerceCell(f({ type: "number" }), "1.234,5"), { ok: true, value: 1234.5 })
  assert.deepEqual(coerceCell(f({ type: "number" }), "x"), { ok: false, code: "invalid_number" })
  assert.deepEqual(coerceCell(f({ type: "integer" }), "42"), { ok: true, value: 42 })
  assert.deepEqual(coerceCell(f({ type: "integer" }), "4,5"), { ok: false, code: "invalid_integer" })
  assert.deepEqual(coerceCell(f({ type: "integer" }), "x"), { ok: false, code: "invalid_integer" })
})

test("coerceCell: boolean in Spanish and English", () => {
  for (const w of ["sí", "SI", "Yes", "true", "1", "Verdadero"])
    assert.deepEqual(coerceCell(f({ type: "boolean" }), w), { ok: true, value: true }, w)
  for (const w of ["no", "No", "false", "0", "falso"])
    assert.deepEqual(coerceCell(f({ type: "boolean" }), w), { ok: true, value: false }, w)
  assert.deepEqual(coerceCell(f({ type: "boolean" }), "quizás"), { ok: false, code: "invalid_boolean" })
})

test("coerceCell: dates are ISO or day-first, and must exist", () => {
  const d = f({ type: "date" })
  assert.deepEqual(coerceCell(d, "2026-11-15"), { ok: true, value: "2026-11-15" })
  assert.deepEqual(coerceCell(d, "5/3/2026"), { ok: true, value: "2026-03-05" })
  assert.deepEqual(coerceCell(d, "05-03-2026"), { ok: true, value: "2026-03-05" })
  assert.deepEqual(coerceCell(d, "29/02/2028"), { ok: true, value: "2028-02-29" })
  for (const bad of ["29/02/2027", "31/04/2026", "2026-13-01", "ayer", "2026/11/15", "11/15/26"])
    assert.deepEqual(coerceCell(d, bad), { ok: false, code: "invalid_date" }, bad)
})

test("coerceCell: a Zod schema runs on the converted value and may transform it", () => {
  const field = f({ type: "integer", schema: z.number().min(18) })
  assert.deepEqual(coerceCell(field, "20"), { ok: true, value: 20 })
  assert.deepEqual(coerceCell(field, "10"), { ok: false, code: "invalid_value" })
  const upper = f({ schema: z.string().transform((s) => s.toUpperCase()) })
  assert.deepEqual(coerceCell(upper, "ab"), { ok: true, value: "AB" })
  // an empty optional cell skips the schema
  assert.deepEqual(coerceCell(field, ""), { ok: true, value: null })
})

// ── target, mapping, plan ─────────────────────────────────────────────

function contactsTarget(inserted: ImportRow[][] = []): ImportTarget {
  return {
    id: "contactos",
    label: { es: "Contactos", en: "Contacts" },
    fields: [
      { key: "name", label: { es: "Nombre", en: "Name" }, required: true },
      { key: "email", label: { es: "Correo electrónico", en: "Email" }, type: "email", aliases: ["mail", "correo"] },
      { key: "age", label: "Edad", type: "integer" },
    ],
    insert: async (rows) => {
      inserted.push(rows)
    },
  }
}

test("normalizeHeader: no accents, case or punctuation", () => {
  assert.equal(normalizeHeader(" Correo Electrónico "), "correoelectronico")
  assert.equal(normalizeHeader("E-mail"), "email")
  assert.equal(normalizeHeader("¿?"), "")
})

test("suggestMapping: by key, label in es/en and alias; one column once", () => {
  const t = contactsTarget()
  assert.deepEqual(suggestMapping(t, ["Nombre", "Correo electrónico", "EDAD"]), { name: 0, email: 1, age: 2 })
  assert.deepEqual(suggestMapping(t, ["Name", "mail"]), { name: 0, email: 1, age: null })
  assert.deepEqual(suggestMapping(t, ["x", "y"]), { name: null, email: null, age: null })
  assert.deepEqual(suggestMapping(t, ["nombre", "nombre"]), { name: 0, email: null, age: null })
  assert.deepEqual(suggestMapping(t, ["", ""]), { name: null, email: null, age: null })
})

test("planImport: valid rows, errors by row (header is row 1) and a text sample", () => {
  const t = contactsTarget()
  const plan = planImport(
    t,
    ["Nombre", "Correo", "Edad"],
    [
      ["Ana", "ana@ejemplo.cl", "30"],
      ["", "no-es-correo", "x"],
      ["Luis", "", ""],
    ],
    { name: 0, email: 1, age: 2 }
  )
  assert.equal(plan.totalRows, 3)
  assert.deepEqual(plan.valid, [
    { row: 2, values: { name: "Ana", email: "ana@ejemplo.cl", age: 30 } },
    { row: 4, values: { name: "Luis", email: null, age: null } },
  ])
  assert.equal(plan.errorRowCount, 1)
  assert.deepEqual(plan.errors, [
    { row: 3, field: "name", code: "required" },
    { row: 3, field: "email", code: "invalid_email" },
    { row: 3, field: "age", code: "invalid_integer" },
  ])
  assert.equal(plan.sample.length, 3)
  assert.deepEqual(plan.sample[1], { row: 3, cells: { name: "", email: "no-es-correo", age: "x" } })
})

test("planImport: a short row is padded, a long row is an error", () => {
  const t = contactsTarget()
  const plan = planImport(t, ["n", "e", "a"], [["Ana"], ["Luis", "l@x.cl", "5", "sobra"]], { name: 0, email: 1, age: 2 })
  assert.deepEqual(plan.valid, [{ row: 2, values: { name: "Ana", email: null, age: null } }])
  assert.deepEqual(plan.errors, [{ row: 3, field: null, code: "extra_cells" }])
  assert.equal(plan.errorRowCount, 1)
})

test("planImport: an unmapped optional field is null; an unmapped required one is an error per row", () => {
  const t = contactsTarget()
  const plan = planImport(t, ["a"], [["x"], ["y"]], { name: null, email: null, age: null })
  assert.equal(plan.valid.length, 0)
  assert.equal(plan.errorRowCount, 2)
  assert.ok(plan.errors.every((e) => e.field === "name" && e.code === "required"))
})

test("planImport: reported errors are capped but the count of bad rows is exact", () => {
  const t = contactsTarget()
  const rows = Array.from({ length: 500 }, () => [""])
  const plan = planImport(t, ["n"], rows, { name: 0, email: null, age: null })
  assert.equal(plan.errorRowCount, 500)
  assert.equal(plan.errors.length, 200)
  assert.equal(plan.sample.length, 10)
})

test("prepareImport: suggests a mapping, parses and plans; missing required → no plan", () => {
  const t = contactsTarget()
  const p = prepareImport(t, "﻿Nombre;Correo\nAna;ana@ejemplo.cl\n")
  assert.equal(p.delimiter, ";")
  assert.deepEqual(p.mapping, { name: 0, email: 1, age: null })
  assert.deepEqual(p.missing, [])
  assert.equal(p.plan?.valid.length, 1)

  const q = prepareImport(t, "a,b\n1,2")
  assert.deepEqual(q.missing, ["name"])
  assert.equal(q.plan, null)

  const r = prepareImport(t, "a,b\n1,2", { mapping: { name: 1 } })
  assert.deepEqual(r.mapping, { name: 1, email: null, age: null })
  assert.equal(r.plan?.valid[0]?.values.name, "2")
})

test("prepareImport: a mapping from outside is checked (unknown field, column out of range)", () => {
  const t = contactsTarget()
  assert.equal(code(() => prepareImport(t, "a,b\n1,2", { mapping: { nope: 0 } })), "invalid_mapping")
  assert.equal(code(() => prepareImport(t, "a,b\n1,2", { mapping: { name: 2 } })), "invalid_mapping")
  assert.equal(code(() => prepareImport(t, "a,b\n1,2", { mapping: { name: -1 } })), "invalid_mapping")
  assert.equal(code(() => prepareImport(t, "a,b\n1,2", { mapping: { name: 0.5 } })), "invalid_mapping")
  assert.equal(code(() => prepareImport(t, "", {})), "empty")
})

// ── registry ──────────────────────────────────────────────────────────

test("registerImportTarget: registers, lists sorted, replaces by id", () => {
  clearImportTargets()
  const b = registerImportTarget({ ...contactsTarget(), id: "b-target" })
  registerImportTarget({ ...contactsTarget(), id: "a-target" })
  assert.deepEqual(listImportTargets().map((x) => x.id), ["a-target", "b-target"])
  assert.equal(findImportTarget("b-target"), b)
  assert.equal(findImportTarget("zzz"), undefined)
  registerImportTarget({ ...contactsTarget(), id: "b-target", label: "otra" })
  assert.equal(listImportTargets().length, 2)
  assert.equal(findImportTarget("b-target")?.label, "otra")
  clearImportTargets()
})

test("registerImportTarget: bad ids, no fields, repeated or badly written field keys", () => {
  clearImportTargets()
  for (const id of ["", "Contactos", "1a", "a b", "x".repeat(64)])
    assert.equal(code(() => registerImportTarget({ ...contactsTarget(), id })), "invalid_target", id)
  assert.equal(code(() => registerImportTarget({ ...contactsTarget(), fields: [] })), "invalid_target")
  assert.equal(
    code(() => registerImportTarget({ ...contactsTarget(), fields: [{ key: "a", label: "A" }, { key: "a", label: "B" }] })),
    "invalid_target"
  )
  assert.equal(code(() => registerImportTarget({ ...contactsTarget(), fields: [{ key: "1a", label: "A" }] })), "invalid_target")
  assert.equal(code(() => registerImportTarget({ ...contactsTarget(), insert: undefined as never })), "invalid_target")
  assert.equal(listImportTargets().length, 0)
})

test("localize: string as is, es/en pairs by locale", () => {
  assert.equal(localize("Hola", "en"), "Hola")
  assert.equal(localize({ es: "Hola", en: "Hi" }, "en"), "Hi")
  assert.equal(localize({ es: "Hola", en: "Hi" }, "fr"), "Hola")
})

// ── store with a fake Kysely ──────────────────────────────────────────

type Log = { inserted: { table: string; values: unknown }[]; committed: boolean; rolledBack: boolean }

/** Minimal fake: `transaction().execute(fn)` commits on return and rolls back (discards its writes) on throw. */
function fakeDb(log: Log) {
  const make = (sink: { table: string; values: unknown }[]) => ({
    insertInto: (table: string) => ({
      values: (values: unknown) => ({
        execute: async () => {
          sink.push({ table, values })
        },
      }),
    }),
  })
  return {
    ...make(log.inserted),
    transaction: () => ({
      execute: async (fn: (trx: unknown) => Promise<void>) => {
        const pending: { table: string; values: unknown }[] = []
        try {
          await fn(make(pending))
        } catch (e) {
          log.rolledBack = true
          throw e
        }
        log.committed = true
        log.inserted.push(...pending)
      },
    }),
  }
}

const rowsOf = (n: number): ImportRow[] => Array.from({ length: n }, (_, i) => ({ name: `n${i}` }))

test("chunk", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
  assert.deepEqual(chunk([], 3), [])
})

test("runImportWith: batches of IMPORT_BATCH_SIZE inside one transaction, plus the history row", async () => {
  const log: Log = { inserted: [], committed: false, rolledBack: false }
  const batches: number[] = []
  const target: ImportTarget = { ...contactsTarget(), insert: async (rows) => void batches.push(rows.length) }
  const n = IMPORT_BATCH_SIZE * 2 + 5
  const out = await runImportWith(fakeDb(log) as never, target, rowsOf(n), {
    userId: "u1",
    fileName: "contactos.csv",
    totalRows: n + 3,
    skippedRows: 3,
  })
  assert.deepEqual(out, { ok: true, imported: n })
  assert.deepEqual(batches, [IMPORT_BATCH_SIZE, IMPORT_BATCH_SIZE, 5])
  assert.equal(log.committed, true)
  assert.equal(log.inserted.length, 1)
  const run = log.inserted[0]
  assert.equal(run?.table, "csv_import_runs")
  assert.deepEqual(
    { ...(run?.values as object), id: undefined },
    {
      id: undefined,
      target: "contactos",
      file_name: "contactos.csv",
      total_rows: n + 3,
      skipped_rows: 3,
      created_by: "u1",
      status: "done",
      imported_rows: n,
      error_code: null,
    }
  )
})

test("runImportWith: a batch that throws rolls everything back and records a failed run without values", async () => {
  const log: Log = { inserted: [], committed: false, rolledBack: false }
  let calls = 0
  const target: ImportTarget = {
    ...contactsTarget(),
    insert: async () => {
      calls++
      if (calls === 2) throw new Error("duplicate key value (ana@ejemplo.cl)")
    },
  }
  const quiet = console.error
  console.error = () => {}
  let out
  try {
    out = await runImportWith(fakeDb(log) as never, target, rowsOf(IMPORT_BATCH_SIZE + 1), {
      userId: null,
      fileName: null,
      totalRows: IMPORT_BATCH_SIZE + 1,
      skippedRows: 0,
    })
  } finally {
    console.error = quiet
  }
  assert.deepEqual(out, { ok: false })
  assert.equal(log.rolledBack, true)
  assert.equal(log.committed, false)
  // the only write that survived is the "failed" history row, and it carries no message from the error
  assert.equal(log.inserted.length, 1)
  const v = log.inserted[0]?.values as Record<string, unknown>
  assert.equal(v.status, "failed")
  assert.equal(v.imported_rows, 0)
  assert.equal(v.error_code, "insert_failed")
  assert.doesNotMatch(JSON.stringify(v), /ana@ejemplo|duplicate/)
})

test("runImportWith: zero valid rows is a successful empty run", async () => {
  const log: Log = { inserted: [], committed: false, rolledBack: false }
  const out = await runImportWith(fakeDb(log) as never, contactsTarget(), [], {
    userId: "u",
    fileName: null,
    totalRows: 4,
    skippedRows: 4,
  })
  assert.deepEqual(out, { ok: true, imported: 0 })
})

// ── catalog, permissions, manifest, code ──────────────────────────────

test("catalog: same keys in es and en, same ICU arguments, and a text per error code", () => {
  const flat = (o: object, p = ""): [string, string][] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [[p + k, v] as [string, string]] : flat(v, `${p}${k}.`)))
  const esFlat = flat(es)
  const enFlat = flat(en)
  assert.deepEqual(enFlat.map(([k]) => k).sort(), esFlat.map(([k]) => k).sort())
  const args = (s: string) => [...s.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((m) => m[1])
  const enMap = new Map(enFlat)
  for (const [k, v] of esFlat) {
    assert.ok(v.length > 0 && (enMap.get(k) ?? "").length > 0, k)
    assert.deepEqual(args(enMap.get(k) ?? ""), args(v), k)
  }
  assert.deepEqual(Object.keys(es), ["csv-import"])
  for (const c of CELL_ERROR_CODES) assert.ok(c in es["csv-import"].cellErrors, c)
  for (const c of ["empty", "no_rows", "too_large", "too_many_rows", "too_many_columns", "unterminated_quote", "invalid_target", "unknown_target", "invalid_mapping"])
    assert.ok(c in es["csv-import"].parseErrors, c)
})

test("permissions: import:run, adminAccess, no grant for member", () => {
  assert.deepEqual(permissions.statement, { import: ["run"] })
  assert.deepEqual(permissions.adminAccess, { import: ["run"] })
  assert.equal("grants" in permissions, false)
})

test("manifest: table, migration, route, covers, entrypoints and nav", () => {
  const m = JSON.parse(read("manifest.json"))
  assert.equal(m.id, "csv-import")
  assert.deepEqual(m.tables, ["csv_import_runs"])
  assert.deepEqual(m.migrations, ["0114_csv_import_init"])
  assert.deepEqual(m.routes, [{ path: "/admin/import", entry: "ui/page.tsx" }])
  assert.ok(m.covers.includes("import") && m.covers.includes("importación"))
  assert.equal(m.dependencies, undefined)
  assert.match(read("db/migrations/0114_csv_import_init.ts"), /create table csv_import_runs/)
  assert.match(read("nav.ts"), /area: "admin"/)
  assert.match(read("nav.ts"), /import: \["run"\]/)
})

test("every Server Action checks session + permission, validates and looks up the target before writing", () => {
  const src = read("server/actions.ts")
  assert.match(src, /^"use server"/)
  const actions = [...src.matchAll(/export async function (\w+)\(/g)].map((m) => m[1])
  assert.deepEqual(actions.sort(), ["previewImportAction", "runImportAction"])
  for (const name of actions) {
    const start = src.indexOf(`export async function ${name}(`)
    const next = src.indexOf("export async function", start + 1)
    const body = src.slice(start, next === -1 ? undefined : next)
    const guard = body.indexOf('await actionSession("/admin/import")')
    assert.ok(guard > 0, `${name}: no guard`)
    assert.ok(body.indexOf("inputSchema.safeParse(") > guard, `${name}: parses before the guard`)
    assert.ok(body.indexOf("findImportTarget(") > body.indexOf("inputSchema.safeParse("), `${name}: target before validation`)
    assert.ok(body.indexOf("prepareImport(") > body.indexOf("findImportTarget("), `${name}: prepares before the target lookup`)
  }
  const run = src.slice(src.indexOf("export async function runImportAction("))
  assert.ok(run.indexOf("plan.errorRowCount > 0 && !skipInvalid") < run.indexOf("await runImportWith("))
  assert.match(src, /text: z\.string\(\)\.max\(MAX_CSV_BYTES\)/)
})

test("the store writes through Kysely only, in one transaction (no concatenated SQL)", () => {
  const store = read("server/store.ts")
  assert.doesNotMatch(store, /sql`/)
  assert.match(store, /transaction\(\)\.execute/)
  assert.doesNotMatch(read("server/queries.ts"), /sql`/)
})

test("the module imports no other module except i18n contracts and has no npm dependency", () => {
  const files = ["server/actions.ts", "server/guard.ts", "server/store.ts", "server/queries.ts", "ui/page.tsx", "ui/import-wizard.tsx", "contracts/registry.ts", "seed.ts"]
  for (const rel of files) {
    for (const m of read(rel).matchAll(/from "@\/modules\/([^/"]+)([^"]*)"/g)) {
      assert.equal(m[1], "i18n", `${rel} imports ${m[0]}`)
      assert.match(m[2] ?? "", /^\/contracts/, `${rel} imports ${m[0]}`)
    }
  }
})
