/**
 * pdf-docs v0.1 — runs without a database or Next. Relative imports only
 * (runs transpiled, no `@/` alias). The PDF is plain ASCII, so it is read back
 * as a latin1 string and its structure (xref, lengths, escaping) is verified
 * byte by byte.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  certificateTemplate,
  orderTemplate,
  pdfResponse,
  renderPdf,
  safePdfName,
  wrapText,
  type PdfDefinition,
} from "../contracts/pdf"
import { textWidth } from "../server/winansi"

/** Fixture text, not UI copy: keeps the literal-text scanner (tests/i18n.test.ts) quiet. */
const lit = (s: string) => s

const text = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1")
const pageCount = (s: string) => (s.match(/\/Type \/Page(?!s)/g) ?? []).length

const hello: PdfDefinition = { blocks: [{ type: "paragraph", text: "Hola" }] }

test("starts with %PDF- and ends with %%EOF", () => {
  const s = text(renderPdf(hello))
  assert.ok(s.startsWith("%PDF-1.4\n"))
  assert.equal(s.trimEnd().endsWith("%%EOF"), true)
  assert.equal(s.trimEnd().split("\n").pop(), "%%EOF")
})

test("xref offsets point at the real start of every object", () => {
  for (const def of [hello, orderTemplate(), certificateTemplate(), longDoc(300)]) {
    const s = text(renderPdf(def))
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(s)?.[1])
    assert.equal(s.slice(startxref, startxref + 5), "xref\n")
    const lines = s.slice(startxref).split("\n")
    const [first, count] = (lines[1] ?? "").split(" ").map(Number)
    assert.equal(first, 0)
    assert.equal(lines[2], "0000000000 65535 f ")
    for (let n = 1; n < (count ?? 0); n++) {
      const entry = lines[2 + n] ?? ""
      assert.match(entry, /^\d{10} 00000 n $/)
      assert.equal(entry.length + 1, 20) // 20 bytes per entry with the "\n"
      const off = Number(entry.slice(0, 10))
      assert.ok(s.startsWith(`${n} 0 obj\n`, off), `object ${n} at ${off}`)
    }
    assert.match(s, new RegExp(`/Size ${count}`))
  }
})

test("stream /Length equals the real stream length", () => {
  const s = text(renderPdf(orderTemplate()))
  const re = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g
  let m: RegExpExecArray | null
  let n = 0
  while ((m = re.exec(s))) {
    assert.equal(Number(m[1]), (m[2] ?? "").length)
    n++
  }
  assert.ok(n >= 1)
})

test("accents and ñ are WinAnsi-encoded (octal escapes), fonts declare WinAnsiEncoding", () => {
  const s = text(renderPdf({ blocks: [{ type: "paragraph", text: "Información ñandú Ñ ¿Qué? €" }] }))
  assert.ok(s.includes("(Informaci\\363n \\361and\\372 \\321 \\277Qu\\351? \\200)"), "encoded text")
  assert.ok(s.includes("/Encoding /WinAnsiEncoding"))
  assert.ok(!/[\u0080-ÿ]/.test(s.split("\n").slice(2).join("\n")), "body is pure ASCII")
})

test("characters outside WinAnsi become ?", () => {
  const s = text(renderPdf({ blocks: [{ type: "paragraph", text: "ok 漢 ok" }] }))
  assert.ok(s.includes("(ok ? ok)"))
})

test("special characters ( ) \\ are escaped", () => {
  const s = text(renderPdf({ blocks: [{ type: "paragraph", text: "a (b) c \\ d" }] }))
  assert.ok(s.includes("(a \\(b\\) c \\\\ d)"))
  const t = text(renderPdf({ title: lit("Orden (1)\\"), blocks: [] }))
  assert.ok(t.includes("/Title (Orden \\(1\\)\\\\)"))
})

test("Helvetica metrics: known widths", () => {
  assert.equal(textWidth("Hello", "regular", 10), 22.78) // 722+556+222+222+556
  assert.equal(textWidth("Hello", "bold", 10), 7.22 + 5.56 + 2.78 + 2.78 + 6.11)
  assert.equal(textWidth("é", "regular", 1000), 556)
  assert.equal(textWidth("Ñ", "regular", 1000), 722)
})

test("wrapText respects the width, keeps words and breaks on \\n", () => {
  const words = "uno dos tres cuatro cinco seis siete ocho nueve diez".split(" ")
  const lines = wrapText(words.join(" "), "regular", 10, 80)
  assert.ok(lines.length > 2)
  for (const l of lines) assert.ok(textWidth(l, "regular", 10) <= 80, l)
  assert.deepEqual(lines.join(" ").split(" "), words)
  assert.deepEqual(wrapText("a\nb", "regular", 10, 200), ["a", "b"])
  assert.deepEqual(wrapText("a\n\nb", "regular", 10, 200), ["a", "", "b"])
})

test("a word wider than the line is cut by characters", () => {
  const lines = wrapText("x".repeat(200), "regular", 10, 50)
  assert.ok(lines.length > 1)
  for (const l of lines) assert.ok(textWidth(l, "regular", 10) <= 50)
  assert.equal(lines.join(""), "x".repeat(200))
})

function longDoc(paragraphs: number): PdfDefinition {
  return {
    footer: { text: "pie" },
    header: { left: "Encabezado" },
    blocks: Array.from({ length: paragraphs }, (_, i) => ({
      type: "paragraph" as const,
      text: `Párrafo ${i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.`,
    })),
  }
}

test("a long document paginates; page numbers and /Count agree", () => {
  const s = text(renderPdf(longDoc(300)))
  const n = pageCount(s)
  assert.ok(n >= 5, `pages: ${n}`)
  assert.match(s, new RegExp(`/Count ${n} `))
  assert.ok(s.includes(`(P\\341gina 1 de ${n})`))
  assert.ok(s.includes(`(P\\341gina ${n} de ${n})`))
  assert.ok(s.includes("(Encabezado)"))
  assert.equal(pageCount(text(renderPdf(hello))), 1)
  assert.equal(pageCount(text(renderPdf({ blocks: [] }))), 1)
})

test("letter and A4 page sizes", () => {
  assert.ok(text(renderPdf(hello)).includes("/MediaBox [0 0 595.28 841.89]"))
  assert.ok(text(renderPdf({ ...hello, pageSize: "letter" })).includes("/MediaBox [0 0 612 792]"))
})

test("a long table spans pages and repeats its header", () => {
  const s = text(
    renderPdf({
      blocks: [
        {
          type: "table",
          columns: [{ header: "Cod" }, { header: "Detalle", width: 3 }],
          rows: Array.from({ length: 120 }, (_, i) => [`C${i}`, "Detalle de la fila con varias palabras para ocupar espacio"]),
        },
      ],
    })
  )
  const pages = pageCount(s)
  assert.ok(pages >= 3, `pages: ${pages}`)
  assert.equal((s.match(/\(Cod\)/g) ?? []).length, pages)
})

test("one very tall row is split across pages instead of looping or overflowing", () => {
  const big = Array.from({ length: 400 }, (_, i) => `linea ${i}`).join("\n")
  const s = text(renderPdf({ blocks: [{ type: "table", columns: [{ header: "A" }], rows: [[big]] }] }))
  assert.ok(pageCount(s) >= 3)
  assert.ok(s.includes("(linea 399)"))
})

test("all block types render", () => {
  const s = text(
    renderPdf({
      blocks: [
        { type: "title", text: "T", subtitle: "S" },
        { type: "heading", text: "H" },
        { type: "paragraph", text: "P", align: "center" },
        { type: "keyValue", rows: [{ label: "L", value: "V" }] },
        { type: "divider" },
        { type: "spacer" },
        { type: "signature", signers: [{ name: "Ana", role: "R" }, { name: "Beto" }, { name: "Cata" }, { name: "Dani" }] },
      ],
    })
  )
  for (const w of ["(T)", "(S)", "(H)", "(P)", "(L)", "(V)", "(Ana)", "(Dani)"]) assert.ok(s.includes(w), w)
})

test("bad input throws", () => {
  assert.throws(() => renderPdf({ blocks: "x" } as unknown as PdfDefinition))
  assert.throws(() => renderPdf({ blocks: [{ type: "nope" }] } as unknown as PdfDefinition))
})

test("example templates render", () => {
  const order = text(renderPdf(orderTemplate()))
  assert.ok(order.includes("(Orden de trabajo)"))
  assert.ok(order.includes("(Total: $856.800)"))
  const cert = text(renderPdf(certificateTemplate()))
  assert.ok(cert.includes("/MediaBox [0 0 612 792]"))
  assert.ok(cert.includes("CERTIFICADO DE APROBACI\\323N"))
})

test("deterministic without createdAt; CreationDate only when given", () => {
  assert.equal(text(renderPdf(hello)), text(renderPdf(hello)))
  assert.ok(!text(renderPdf(hello)).includes("CreationDate"))
  assert.ok(text(renderPdf({ ...hello, createdAt: new Date("2026-11-14T10:20:30Z") })).includes("/CreationDate (D:20261114102030Z)"))
})

test("pdfResponse headers and safePdfName", async () => {
  const bytes = renderPdf(hello)
  const res = pdfResponse(bytes, { filename: "Orden ñandú/../x" })
  assert.equal(res.headers.get("content-type"), "application/pdf")
  assert.equal(res.headers.get("content-length"), String(bytes.length))
  const cd = res.headers.get("content-disposition") ?? ""
  assert.ok(cd.startsWith("inline;"))
  assert.ok(!cd.includes("/"))
  assert.ok(cd.includes("filename*=UTF-8''"))
  assert.ok(pdfResponse(bytes, { download: true }).headers.get("content-disposition")?.startsWith("attachment;"))
  assert.deepEqual(new Uint8Array(await res.arrayBuffer()), bytes)
  assert.equal(safePdfName("a.PDF"), "a.pdf")
  assert.equal(safePdfName("  "), "documento.pdf")
  assert.equal(safePdfName('..\\"x"'), "x.pdf")
})

test("manifest: no dependencies, depends on storage only", () => {
  const m = JSON.parse(readFileSync(join(process.cwd(), "modules/pdf-docs", "manifest.json"), "utf8")) as Record<string, unknown>
  assert.deepEqual(m.dependencies, {})
  assert.deepEqual(m.dependsOn, ["storage"])
})
