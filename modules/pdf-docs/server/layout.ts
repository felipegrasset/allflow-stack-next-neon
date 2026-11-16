/**
 * Lays a `PdfDefinition` out into page content streams: word wrapping by
 * Helvetica metrics, automatic pagination, header and footer with page numbers.
 * Pure functions; no I/O.
 */
import { FONT_RESOURCE, fmt, type RawPage } from "./pdf-writer"
import type { Align, PageSize, PdfBlock, PdfDefinition, Rgb } from "./types"
import { encodeWinAnsi, pdfLiteral, textWidth, type FontName } from "./winansi"

export const PAGE_SIZES: Record<PageSize, readonly [number, number]> = {
  A4: [595.28, 841.89],
  letter: [612, 792],
}
export const MAX_PAGES = 500

const INK: Rgb = [0.13, 0.15, 0.18]
const MUTED: Rgb = [0.42, 0.45, 0.5]
const RULE: Rgb = [0.85, 0.87, 0.9]
const DEFAULT_ACCENT: Rgb = [0.1, 0.32, 0.55]
const TINT: Rgb = [0.94, 0.96, 0.98]

/** Splits `text` into lines no wider than `maxWidth` (words; a word wider than the line is cut by characters). `\n` breaks. */
export function wrapText(text: string, font: FontName, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const para of text.replace(/\r\n?/g, "\n").split("\n")) {
    const words = para.split(/[ \t]+/).filter(Boolean)
    let line = ""
    const push = () => {
      lines.push(line)
      line = ""
    }
    for (const word of words) {
      let w = word
      while (textWidth(w, font, size) > maxWidth && w.length > 1) {
        // Cut the word at the longest prefix that fits (at least one character).
        if (line) push()
        let n = 1
        while (n < w.length && textWidth(w.slice(0, n + 1), font, size) <= maxWidth) n++
        lines.push(w.slice(0, n))
        w = w.slice(n)
      }
      const candidate = line ? `${line} ${w}` : w
      if (line && textWidth(candidate, font, size) > maxWidth) {
        push()
        line = w
      } else line = candidate
    }
    push()
  }
  return lines
}

type Page = { ops: string[] }

class Layout {
  readonly width: number
  readonly height: number
  readonly margin: number
  readonly accent: Rgb
  readonly contentWidth: number
  readonly top: number
  readonly bottom: number
  pages: Page[] = []
  y = 0

  constructor(readonly def: PdfDefinition) {
    const [w, h] = PAGE_SIZES[def.pageSize ?? "A4"] ?? PAGE_SIZES.A4
    this.width = w
    this.height = h
    this.margin = Math.min(120, Math.max(36, def.margin ?? 50))
    this.accent = def.accent ?? DEFAULT_ACCENT
    this.contentWidth = w - 2 * this.margin
    this.top = h - this.margin - (def.header ? 22 : 0)
    this.bottom = this.margin
    this.newPage()
  }

  get page(): Page {
    return this.pages[this.pages.length - 1] as Page
  }

  newPage() {
    if (this.pages.length >= MAX_PAGES) throw new Error(`renderPdf: more than ${MAX_PAGES} pages`)
    this.pages.push({ ops: [] })
    this.y = this.top
  }

  ensure(h: number) {
    if (this.y - h < this.bottom && this.y < this.top) this.newPage()
  }

  // ── drawing primitives ────────────────────────────────────────────────────
  text(page: Page, s: string, x: number, y: number, font: FontName, size: number, color: Rgb) {
    if (!s) return
    page.ops.push(
      `BT\n/${FONT_RESOURCE[font]} ${fmt(size)} Tf\n${color.map(fmt).join(" ")} rg\n${fmt(x)} ${fmt(y)} Td\n${pdfLiteral(encodeWinAnsi(s))} Tj\nET`
    )
  }

  /** Text placed inside [x, x+w] with the given alignment. */
  aligned(s: string, x: number, w: number, y: number, font: FontName, size: number, color: Rgb, align: Align) {
    const tw = textWidth(s, font, size)
    const dx = align === "right" ? w - tw : align === "center" ? (w - tw) / 2 : 0
    this.text(this.page, s, x + Math.max(0, dx), y, font, size, color)
  }

  line(page: Page, x1: number, y1: number, x2: number, y2: number, thickness: number, color: Rgb) {
    page.ops.push(`${fmt(thickness)} w\n${color.map(fmt).join(" ")} RG\n${fmt(x1)} ${fmt(y1)} m ${fmt(x2)} ${fmt(y2)} l S`)
  }

  rect(page: Page, x: number, y: number, w: number, h: number, color: Rgb) {
    page.ops.push(`${color.map(fmt).join(" ")} rg\n${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)} re f`)
  }

  // ── blocks ────────────────────────────────────────────────────────────────
  title(b: Extract<PdfBlock, { type: "title" }>) {
    const sub = b.subtitle ? wrapText(b.subtitle, "regular", 11, this.contentWidth) : []
    const lines = wrapText(b.text, "bold", 20, this.contentWidth)
    this.ensure(lines.length * 25 + sub.length * 15 + 20)
    for (const l of lines) {
      this.y -= 20
      this.text(this.page, l, this.margin, this.y, "bold", 20, INK)
      this.y -= 5
    }
    for (const l of sub) {
      this.y -= 11
      this.text(this.page, l, this.margin, this.y, "regular", 11, MUTED)
      this.y -= 4
    }
    this.y -= 6
    this.line(this.page, this.margin, this.y, this.width - this.margin, this.y, 1.4, this.accent)
    this.y -= 14
  }

  heading(b: Extract<PdfBlock, { type: "heading" }>) {
    this.ensure(34)
    this.y -= 8
    this.rect(this.page, this.margin, this.y - 3, 3, 13, this.accent)
    this.text(this.page, b.text, this.margin + 10, this.y, "bold", 11, this.accent)
    this.y -= 14
  }

  paragraph(b: Extract<PdfBlock, { type: "paragraph" }>) {
    const size = b.size ?? 10
    const lh = size * 1.35
    const font: FontName = b.bold ? "bold" : "regular"
    for (const l of wrapText(b.text, font, size, this.contentWidth)) {
      this.ensure(lh)
      this.y -= size
      this.aligned(l, this.margin, this.contentWidth, this.y, font, size, b.muted ? MUTED : INK, b.align ?? "left")
      this.y -= lh - size
    }
    this.y -= 4
  }

  keyValue(b: Extract<PdfBlock, { type: "keyValue" }>) {
    const size = 9.5
    const lh = size * 1.4
    const labelW = Math.min(this.contentWidth * 0.7, Math.max(40, b.labelWidth ?? this.contentWidth * 0.3))
    const valueX = this.margin + labelW
    for (const row of b.rows) {
      const labelLines = wrapText(row.label, "bold", size, labelW - 8)
      const valueLines = wrapText(row.value, "regular", size, this.contentWidth - labelW)
      const n = Math.max(labelLines.length, valueLines.length)
      for (let i = 0; i < n; i++) {
        this.ensure(lh)
        this.y -= size
        this.text(this.page, labelLines[i] ?? "", this.margin, this.y, "bold", size, MUTED)
        this.text(this.page, valueLines[i] ?? "", valueX, this.y, "regular", size, INK)
        this.y -= lh - size
      }
      this.y -= 2
    }
    this.y -= 4
  }

  table(b: Extract<PdfBlock, { type: "table" }>) {
    const size = 9
    const lh = size * 1.35
    const pad = 4
    const cols = b.columns
    if (cols.length === 0) return
    const total = cols.reduce((s, c) => s + Math.max(0.1, c.width ?? 1), 0)
    const widths = cols.map((c) => (Math.max(0.1, c.width ?? 1) / total) * this.contentWidth)
    const xs: number[] = []
    widths.reduce((x, w) => (xs.push(x), x + w), this.margin)

    const drawRow = (cells: readonly string[], header: boolean) => {
      const font: FontName = header ? "bold" : "regular"
      const wrapped = cols.map((_, i) => wrapText(cells[i] ?? "", font, size, (widths[i] ?? 0) - 2 * pad))
      const n = Math.max(1, ...wrapped.map((l) => l.length))
      let start = 0
      while (start < n) {
        const fit = Math.floor((this.y - this.bottom - 2 * pad) / lh)
        if (fit < 1 && this.y < this.top) {
          this.newPage()
          if (!header) drawRow(b.columns.map((c) => c.header), true)
          continue
        }
        const take = Math.max(1, Math.min(fit, n - start))
        const h = take * lh + 2 * pad
        if (header) this.rect(this.page, this.margin, this.y - h, this.contentWidth, h, TINT)
        for (let c = 0; c < cols.length; c++) {
          for (let k = 0; k < take; k++) {
            const s = wrapped[c]?.[start + k] ?? ""
            this.aligned(
              s,
              (xs[c] ?? 0) + pad,
              (widths[c] ?? 0) - 2 * pad,
              this.y - pad - size - k * lh + (lh - size) / 2,
              font,
              size,
              header ? this.accent : INK,
              cols[c]?.align ?? "left"
            )
          }
        }
        this.y -= h
        this.line(this.page, this.margin, this.y, this.width - this.margin, this.y, header ? 0.9 : 0.5, header ? this.accent : RULE)
        start += take
      }
    }

    drawRow(cols.map((c) => c.header), true)
    for (const row of b.rows) drawRow(row, false)
    this.y -= 8
  }

  divider() {
    this.ensure(16)
    this.y -= 8
    this.line(this.page, this.margin, this.y, this.width - this.margin, this.y, 0.6, RULE)
    this.y -= 8
  }

  spacer(b: Extract<PdfBlock, { type: "spacer" }>) {
    this.y -= Math.max(0, Math.min(200, b.height ?? 12))
  }

  signature(b: Extract<PdfBlock, { type: "signature" }>) {
    const perRow = 3
    for (let i = 0; i < b.signers.length; i += perRow) {
      const row = b.signers.slice(i, i + perRow)
      this.ensure(90)
      this.y -= 52
      const slot = this.contentWidth / perRow
      row.forEach((s, k) => {
        const x = this.margin + k * slot
        this.line(this.page, x + 6, this.y, x + slot - 18, this.y, 0.8, INK)
        this.text(this.page, s.name, x + 6, this.y - 12, "bold", 9.5, INK)
        if (s.role) this.text(this.page, s.role, x + 6, this.y - 24, "regular", 8.5, MUTED)
      })
      this.y -= 34
    }
  }

  render(block: PdfBlock) {
    switch (block.type) {
      case "title": return this.title(block)
      case "heading": return this.heading(block)
      case "paragraph": return this.paragraph(block)
      case "keyValue": return this.keyValue(block)
      case "table": return this.table(block)
      case "divider": return this.divider()
      case "spacer": return this.spacer(block)
      case "signature": return this.signature(block)
      default: throw new Error(`renderPdf: unknown block type "${(block as { type?: string }).type}"`)
    }
  }

  /** Header and footer on every page; needs the final page count. */
  decorate() {
    const { def } = this
    const total = this.pages.length
    this.pages.forEach((page, i) => {
      if (def.header) {
        const y = this.height - this.margin + 4
        if (def.header.left) this.text(page, def.header.left, this.margin, y, "bold", 8.5, MUTED)
        if (def.header.right) {
          const w = textWidth(def.header.right, "regular", 8.5)
          this.text(page, def.header.right, this.width - this.margin - w, y, "regular", 8.5, MUTED)
        }
        this.line(page, this.margin, y - 6, this.width - this.margin, y - 6, 0.6, RULE)
      }
      if (def.footer !== false) {
        const y = this.margin - 20
        this.line(page, this.margin, y + 12, this.width - this.margin, y + 12, 0.5, RULE)
        if (def.footer?.text) this.text(page, def.footer.text, this.margin, y, "regular", 8, MUTED)
        const label = (def.footer?.pageLabel ?? "Página {page} de {total}")
          .replace("{page}", String(i + 1))
          .replace("{total}", String(total))
        const w = textWidth(label, "regular", 8)
        this.text(page, label, this.width - this.margin - w, y, "regular", 8, MUTED)
      }
    })
  }
}

/** Runs the layout and returns one raw page per output page. */
export function layoutDocument(def: PdfDefinition): RawPage[] {
  if (!def || !Array.isArray(def.blocks)) throw new Error("renderPdf: `blocks` must be an array")
  const layout = new Layout(def)
  for (const block of def.blocks) layout.render(block)
  layout.decorate()
  return layout.pages.map((p) => ({ width: layout.width, height: layout.height, content: p.ops.join("\n") }))
}
