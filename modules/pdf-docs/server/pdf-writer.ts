/**
 * Minimal PDF 1.4 file writer: catalog, page tree, two standard fonts
 * (Helvetica, Helvetica-Bold, WinAnsiEncoding), one uncompressed content
 * stream per page, info dictionary and a classic xref table. Everything it
 * writes is ASCII (or the single binary-marker comment), so a character index
 * in the string IS the byte offset.
 */
import { encodeWinAnsi, pdfLiteral } from "./winansi"

export type RawPage = { width: number; height: number; content: string }
export type PdfInfo = { title?: string; author?: string; subject?: string; createdAt?: Date }

/** Fixed object numbers. Pages come after: page i is 6 + 2i, its content 7 + 2i. */
export const OBJ = { catalog: 1, pages: 2, fontRegular: 3, fontBold: 4, info: 5 } as const
export const FONT_RESOURCE: Record<"regular" | "bold", string> = { regular: "F1", bold: "F2" }

export function fmt(n: number): string {
  const s = Number(n.toFixed(2)).toString()
  return s === "-0" ? "0" : s
}

function pdfDate(d: Date): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0")
  return `D:${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
}

function toBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff
  return out
}

export function buildPdf(pages: readonly RawPage[], info: PdfInfo = {}): Uint8Array {
  if (pages.length === 0) throw new Error("buildPdf: at least one page is required")
  const objects: string[] = [] // index 0 = object 1
  const set = (num: number, body: string) => {
    objects[num - 1] = body
  }

  const kids = pages.map((_, i) => `${6 + 2 * i} 0 R`).join(" ")
  set(OBJ.catalog, `<< /Type /Catalog /Pages ${OBJ.pages} 0 R >>`)
  set(OBJ.pages, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`)
  set(OBJ.fontRegular, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
  set(OBJ.fontBold, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")

  const entries: string[] = ["/Producer (Fulvia pdf-docs)"]
  if (info.title) entries.push(`/Title ${pdfLiteral(encodeWinAnsi(info.title))}`)
  if (info.author) entries.push(`/Author ${pdfLiteral(encodeWinAnsi(info.author))}`)
  if (info.subject) entries.push(`/Subject ${pdfLiteral(encodeWinAnsi(info.subject))}`)
  if (info.createdAt && !Number.isNaN(info.createdAt.getTime()))
    entries.push(`/CreationDate (${pdfDate(info.createdAt)})`)
  set(OBJ.info, `<< ${entries.join(" ")} >>`)

  pages.forEach((p, i) => {
    const pageNum = 6 + 2 * i
    const contentNum = 7 + 2 * i
    set(
      pageNum,
      `<< /Type /Page /Parent ${OBJ.pages} 0 R /MediaBox [0 0 ${fmt(p.width)} ${fmt(p.height)}] ` +
        `/Resources << /Font << /F1 ${OBJ.fontRegular} 0 R /F2 ${OBJ.fontBold} 0 R >> >> /Contents ${contentNum} 0 R >>`
    )
    set(contentNum, `<< /Length ${p.content.length} >>\nstream\n${p.content}\nendstream`)
  })

  let out = "%PDF-1.4\n%âãÏÓ\n"
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefAt = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${OBJ.catalog} 0 R /Info ${OBJ.info} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`
  return toBytes(out)
}
