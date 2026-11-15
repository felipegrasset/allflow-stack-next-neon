/**
 * export v0.1 — runs without a database or Next: CSV escaping, formula
 * protection, BOM, file names, the registry, the handler (session, permission,
 * limits, filename) with injected dependencies, the button's pure helpers and
 * the catalog. Relative imports only (runs transpiled, no `@/` alias).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { en, es } from "../messages"
import {
  BOM,
  attachmentHeader,
  cellText,
  csvResponse,
  escapeCell,
  neutralizeFormula,
  safeFileName,
  toCsv,
} from "../server/csv"
import { handleExport, type ExportDeps } from "../server/handler"
import {
  clearExports,
  findExport,
  registerExport,
  type ExportDestination,
} from "../server/registry"
import { exportUrl, fileNameFromDisposition, isExportError } from "../ui/download"

// ── formula injection ────────────────────────────────────────────────────────

test("neutralizeFormula prefixes every trigger", () => {
  for (const t of ["=1+1", "+cmd|' /C calc'!A0", "-2+3", "@SUM(A1)", "\t=1", "\r=1", " =1+1", "=HYPERLINK(\"http://x\")"])
    assert.equal(neutralizeFormula(t), `'${t}`, t)
})

test("neutralizeFormula leaves ordinary text and plain negative numbers", () => {
  for (const t of ["hola", "a=b", "1+1", "", "-12", "-12.5", "-12,5", "  -3", "ok @ home"])
    assert.equal(neutralizeFormula(t), t, t)
  assert.equal(neutralizeFormula("-1+1"), "'-1+1")
  assert.equal(neutralizeFormula("-5\n=cmd"), "'-5\n=cmd")
  assert.equal(neutralizeFormula("+56912345678"), "'+56912345678")
})

test("cellText: real numbers are never prefixed, text is", () => {
  assert.equal(cellText(-5), "-5")
  assert.equal(cellText(0.5), "0.5")
  assert.equal(cellText(BigInt(10)), "10")
  assert.equal(cellText("=2+2"), "'=2+2")
  assert.equal(cellText(null), "")
  assert.equal(cellText(undefined), "")
  assert.equal(cellText(NaN), "")
  assert.equal(cellText(Infinity), "")
  assert.equal(cellText(true), "true")
  assert.equal(cellText(new Date("2026-11-14T10:00:00Z")), "2026-11-14T10:00:00.000Z")
  assert.equal(cellText(new Date("nope")), "")
  assert.equal(cellText({ a: "=x" }), '{"a":"=x"}')
  const loop: Record<string, unknown> = {}
  loop.self = loop
  assert.equal(cellText(loop), "")
})

// ── escaping ─────────────────────────────────────────────────────────────────

test("escapeCell quotes only when needed and doubles quotes", () => {
  assert.equal(escapeCell("simple"), "simple")
  assert.equal(escapeCell("a,b"), '"a,b"')
  assert.equal(escapeCell('di "hola"'), '"di ""hola"""')
  assert.equal(escapeCell("línea1\nlínea2"), '"línea1\nlínea2"')
  assert.equal(escapeCell("a\rb"), '"a\rb"')
  assert.equal(escapeCell(" borde "), '" borde "')
  assert.equal(escapeCell("a;b"), "a;b")
  assert.equal(escapeCell("a;b", ";"), '"a;b"')
  assert.equal(escapeCell("a,b", ";"), "a,b")
})

// ── toCsv ────────────────────────────────────────────────────────────────────

type Row = { nombre: string; monto: number | string | null; nota?: string }
const rows: Row[] = [
  { nombre: "Ana, Pérez", monto: 1500, nota: 'dijo "ok"' },
  { nombre: "=cmd|x", monto: "-20.5", nota: "multi\nlínea" },
  { nombre: "Luis", monto: null },
]

test("toCsv: header, quoting, CRLF, trailing newline", () => {
  const csv = toCsv(rows, [
    { header: "Nombre", key: "nombre" },
    { header: "Monto", key: "monto" },
    { header: "Nota", value: (r: Row) => r.nota },
  ])
  assert.equal(
    csv,
    'Nombre,Monto,Nota\r\n"Ana, Pérez",1500,"dijo ""ok"""\r\n\'=cmd|x,-20.5,"multi\nlínea"\r\nLuis,,\r\n'
  )
})

test("toCsv: BOM and delimiter are options; headers can be off", () => {
  const cols = [{ header: "A;B", key: "nombre" }]
  const withBom = toCsv([{ nombre: "x;y" }], cols, { bom: true, delimiter: ";" })
  assert.equal(withBom, `${BOM}"A;B"\r\n"x;y"\r\n`)
  assert.equal(toCsv([{ nombre: "x" }], cols).startsWith(BOM), false)
  assert.equal(toCsv([{ nombre: "x" }], cols, { headers: false }), "x\r\n")
  assert.throws(() => toCsv([], cols, { delimiter: "\t" as ";" }))
})

test("toCsv protects header cells too, and handles no rows", () => {
  assert.equal(toCsv([], [{ header: "=evil", key: "a" }]), "'=evil\r\n")
  assert.equal(toCsv([], [], { headers: false }), "")
})

test("toCsv tolerates missing keys and null rows", () => {
  assert.equal(toCsv([{}, null], [{ header: "H", key: "missing" }]), "H\r\n\r\n\r\n")
})

// ── file names and response ──────────────────────────────────────────────────

test("safeFileName strips paths, quotes and control characters", () => {
  assert.equal(safeFileName("tickets-2026-11-14"), "tickets-2026-11-14.csv")
  assert.equal(safeFileName("reporte.CSV"), "reporte.csv")
  assert.equal(safeFileName('../../etc/pa"ss\r\nwd'), "etc pa ss wd.csv")
  assert.equal(safeFileName("..."), "export.csv")
  assert.equal(safeFileName(undefined, "tickets"), "tickets.csv")
  assert.equal(safeFileName("   "), "export.csv")
  assert.ok(safeFileName("x".repeat(500)).length <= 104)
})

test("attachmentHeader has an ASCII fallback and the UTF-8 name", () => {
  const h = attachmentHeader("niños ñandú.csv")
  assert.ok(h.startsWith('attachment; filename="ni'))
  assert.ok(/^[\x20-\x7e]+$/.test(h))
  assert.ok(h.includes("filename*=UTF-8''ni%C3%B1os%20%C3%B1and%C3%BA.csv"))
})

test("csvResponse sets type, disposition and no-store", async () => {
  const res = csvResponse("a\r\n", { filename: "mi lista" })
  assert.equal(res.status, 200)
  assert.equal(res.headers.get("content-type"), "text/csv; charset=utf-8")
  assert.ok(res.headers.get("content-disposition")?.includes('filename="mi lista.csv"'))
  assert.equal(res.headers.get("x-content-type-options"), "nosniff")
  assert.equal(res.headers.get("cache-control"), "private, no-store")
  assert.equal(await res.text(), "a\r\n")
})

// ── registry ─────────────────────────────────────────────────────────────────

const okQuery = async () => ({ rows: [{ a: "1" }], columns: [{ header: "A", key: "a" }] })

test("registerExport requires a valid id, permission and query", () => {
  clearExports()
  const base = { id: "tickets", permission: { ticket: ["manage"] }, query: okQuery }
  assert.doesNotThrow(() => registerExport(base))
  assert.throws(() => registerExport({ ...base, id: "Bad Id" }), /invalid id/)
  assert.throws(() => registerExport({ ...base, id: "" }), /invalid id/)
  assert.throws(() => registerExport({ ...base, permission: {} }), /permission/)
  assert.throws(() => registerExport({ ...base, permission: { ticket: [] } }), /permission/)
  assert.throws(
    () => registerExport({ ...base, permission: undefined as unknown as Record<string, string[]> }),
    /permission/
  )
  assert.throws(() => registerExport({ ...base, query: undefined as unknown as typeof okQuery }), /query/)
})

test("registerExport replaces the same id and findExport returns it", () => {
  clearExports()
  registerExport({ id: "x", permission: { r: ["a"] }, query: okQuery })
  registerExport({ id: "x", permission: { r: ["b"] }, query: okQuery })
  assert.deepEqual(findExport("x")?.permission, { r: ["b"] })
  assert.equal(findExport("nope"), undefined)
})

// ── handler ──────────────────────────────────────────────────────────────────

function setup(opts: { signedIn?: boolean; allowed?: boolean; dest?: Partial<ExportDestination<Record<string, unknown>>> } = {}) {
  const calls = { can: [] as unknown[], query: 0, logs: [] as string[] }
  const dest: ExportDestination<Record<string, unknown>> = {
    id: "tickets",
    permission: { ticket: ["manage"] },
    query: async () => {
      calls.query++
      return { rows: [{ asunto: "=1+1", n: 2 }], columns: [{ header: "Asunto", key: "asunto" }, { header: "N", key: "n" }] }
    },
    ...opts.dest,
  }
  const deps: ExportDeps = {
    session: async () => (opts.signedIn === false ? null : { userId: "u1" }),
    can: async (p) => {
      calls.can.push(p)
      return opts.allowed !== false
    },
    find: (id) => (id === dest.id ? (dest as unknown as ExportDestination<unknown>) : undefined),
    now: () => new Date("2026-11-14T12:00:00Z"),
    log: (m) => calls.logs.push(m),
  }
  return { deps, calls }
}
const req = (qs = "") => new Request(`https://app.example.test/api/export/tickets${qs}`)

test("handler: no session -> 401 and nothing else runs", async () => {
  const { deps, calls } = setup({ signedIn: false })
  const res = await handleExport("tickets", req(), deps)
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: "unauthorized" })
  assert.equal(calls.can.length, 0)
  assert.equal(calls.query, 0)
})

test("handler: unknown or malformed id -> 404", async () => {
  const { deps } = setup()
  assert.equal((await handleExport("otro", req(), deps)).status, 404)
  assert.equal((await handleExport("../x", req(), deps)).status, 404)
})

test("handler: without the registrant's permission -> 403 and the query never runs", async () => {
  const { deps, calls } = setup({ allowed: false })
  const res = await handleExport("tickets", req(), deps)
  assert.equal(res.status, 403)
  assert.deepEqual(calls.can, [{ ticket: ["manage"] }])
  assert.equal(calls.query, 0)
})

test("handler: a permission check that throws is a 403", async () => {
  const { deps, calls } = setup()
  deps.can = async () => {
    throw new Error("db down")
  }
  assert.equal((await handleExport("tickets", req(), deps)).status, 403)
  assert.equal(calls.query, 0)
})

test("handler: a destination with an empty permission is never served", async () => {
  const { deps, calls } = setup({ dest: { permission: {} } })
  assert.equal((await handleExport("tickets", req(), deps)).status, 403)
  assert.equal(calls.can.length, 0)
  assert.equal(calls.query, 0)
})

test("handler: allowed -> CSV with BOM, protected cells and a dated name", async () => {
  const { deps } = setup()
  const res = await handleExport("tickets", req(), deps)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get("content-type"), "text/csv; charset=utf-8")
  assert.ok(res.headers.get("content-disposition")?.includes('filename="tickets-2026-11-14.csv"'))
  // Response.text() strips a leading BOM, so look at the bytes.
  const bytes = new Uint8Array(await res.arrayBuffer())
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf])
  assert.equal(new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes), `${BOM}Asunto,N\r\n'=1+1,2\r\n`)
})

test("handler: passes the query string and the user to the destination", async () => {
  let seen: { userId: string; status: string | null } | null = null
  const { deps } = setup({
    dest: {
      query: async (ctx) => {
        seen = { userId: ctx.userId, status: ctx.searchParams.get("status") }
        return { rows: [], columns: [{ header: "A", key: "a" }] }
      },
      filename: (ctx) => `tickets ${ctx.searchParams.get("status")}`,
      bom: false,
      delimiter: ";",
    },
  })
  const res = await handleExport("tickets", req("?status=open"), deps)
  assert.deepEqual(seen, { userId: "u1", status: "open" })
  assert.ok(res.headers.get("content-disposition")?.includes('filename="tickets open.csv"'))
  assert.equal(await res.text(), "A\r\n")
})

test("handler: too many rows -> 413, a throwing query -> 500 without leaking the error", async () => {
  const big = setup({
    dest: { maxRows: 2, query: async () => ({ rows: [{}, {}, {}], columns: [{ header: "A", key: "a" }] }) },
  })
  const r413 = await handleExport("tickets", req(), big.deps)
  assert.equal(r413.status, 413)
  assert.deepEqual(await r413.json(), { error: "too_many_rows" })

  const bad = setup({
    dest: {
      query: async () => {
        throw new Error("secret connection string")
      },
    },
  })
  const r500 = await handleExport("tickets", req(), bad.deps)
  assert.equal(r500.status, 500)
  assert.deepEqual(await r500.json(), { error: "failed" })
  assert.equal(bad.calls.logs.length, 1)
})

// ── button helpers and catalog ───────────────────────────────────────────────

test("exportUrl and fileNameFromDisposition", () => {
  assert.equal(exportUrl("tickets"), "/api/export/tickets")
  assert.equal(exportUrl("tickets", { status: "open", q: "", z: undefined, p: "a b" }), "/api/export/tickets?status=open&p=a+b")
  assert.equal(fileNameFromDisposition(null, "f.csv"), "f.csv")
  assert.equal(fileNameFromDisposition('attachment; filename="a b.csv"', "f.csv"), "a b.csv")
  assert.equal(fileNameFromDisposition(attachmentHeader("niños.csv"), "f.csv"), "niños.csv")
  assert.equal(isExportError("forbidden"), true)
  assert.equal(isExportError("zzz"), false)
})

const keysOf = (o: unknown, prefix = ""): string[] =>
  Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === "object" && v ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )

test("catalog: es and en have the same keys under `export`, none empty, one for each error code", () => {
  assert.deepEqual(Object.keys(es), ["export"])
  assert.deepEqual(keysOf(es).sort(), keysOf(en).sort())
  assert.ok(keysOf(es).every((k) => k.length > 0))
  for (const code of ["unauthorized", "forbidden", "not_found", "too_many_rows", "failed", "network"])
    assert.ok(typeof (es.export.errors as Record<string, string>)[code] === "string", code)
})

test("manifest: no tables, one route handler, no extra packages", () => {
  const m = JSON.parse(readFileSync(join(process.cwd(), "modules", "export", "manifest.json"), "utf8"))
  assert.equal(m.id, "export")
  assert.equal(m.tables, undefined)
  assert.equal(m.dependencies, undefined)
  assert.deepEqual(m.routes, [{ path: "/api/export/[id]", entry: "server/route.ts" }])
})
