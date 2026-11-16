/**
 * WinAnsi (Windows-1252) encoding and Helvetica / Helvetica-Bold glyph widths.
 * Pure: no dependencies. Widths are the Adobe AFM values (1000 units per em).
 * Accented Latin letters share the width of their base letter in Helvetica.
 */

export type FontName = "regular" | "bold"

const CP1252_HIGH: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
}

/** Maps one character to its WinAnsi byte; unsupported characters become "?". */
export function winAnsiByte(ch: string): number {
  const cp = ch.codePointAt(0) ?? 63
  if (cp >= 32 && cp <= 126) return cp
  if (cp >= 0xa0 && cp <= 0xff) return cp
  const high = CP1252_HIGH[cp]
  if (high !== undefined) return high
  if (cp === 9) return 32
  return 63
}

/** Encodes a string as WinAnsi bytes (code points, not UTF-16 units). Control characters are dropped. */
export function encodeWinAnsi(text: string): number[] {
  const out: number[] = []
  for (const ch of text.normalize("NFC")) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp < 32 && cp !== 9) continue
    if (cp === 0x7f) continue
    // Zero-width and combining marks left after NFC have no glyph: skip them.
    if ((cp >= 0x200b && cp <= 0x200f) || cp === 0xfeff || (cp >= 0x300 && cp <= 0x36f)) continue
    out.push(winAnsiByte(ch))
  }
  return out
}

const REGULAR_ASCII =
  "278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 " + // 32..47
  "556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 " + // 48..63
  "1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 " + // 64..79
  "667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 " + // 80..95
  "333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 " + // 96..111
  "556 556 333 500 278 556 500 722 500 500 500 334 260 334 584" // 112..126

const BOLD_ASCII =
  "278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 " +
  "556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 " +
  "975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 " +
  "667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 " +
  "333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 " +
  "611 611 389 556 333 611 556 778 556 556 500 389 280 389 584"

/** Glyphs whose width is not that of a base letter, by WinAnsi byte: [regular, bold]. */
const SPECIAL: Record<number, [number, number]> = {
  0x80: [556, 556], 0x82: [222, 278], 0x83: [556, 556], 0x84: [333, 500], 0x85: [1000, 1000],
  0x86: [556, 556], 0x87: [556, 556], 0x88: [333, 333], 0x89: [1000, 1000], 0x8b: [333, 333],
  0x8c: [1000, 1000], 0x91: [222, 278], 0x92: [222, 278], 0x93: [333, 500], 0x94: [333, 500],
  0x95: [350, 350], 0x96: [556, 556], 0x97: [1000, 1000], 0x98: [333, 333], 0x99: [1000, 1000],
  0x9b: [333, 333], 0x9c: [944, 944],
  0xa0: [278, 278], 0xa1: [333, 333], 0xa2: [556, 556], 0xa3: [556, 556], 0xa4: [556, 556],
  0xa5: [556, 556], 0xa6: [260, 280], 0xa7: [556, 556], 0xa8: [333, 333], 0xa9: [737, 737],
  0xaa: [370, 370], 0xab: [556, 556], 0xac: [584, 584], 0xad: [333, 333], 0xae: [737, 737],
  0xaf: [333, 333], 0xb0: [400, 400], 0xb1: [584, 584], 0xb2: [333, 333], 0xb3: [333, 333],
  0xb4: [333, 333], 0xb5: [556, 611], 0xb6: [537, 556], 0xb7: [278, 278], 0xb8: [333, 333],
  0xb9: [333, 333], 0xba: [365, 365], 0xbb: [556, 556], 0xbc: [834, 834], 0xbd: [834, 834],
  0xbe: [834, 834], 0xbf: [611, 611],
  0xc6: [1000, 1000], 0xd0: [722, 722], 0xd7: [584, 584], 0xd8: [778, 778], 0xde: [667, 667],
  0xdf: [611, 611], 0xe6: [889, 889], 0xf0: [556, 611], 0xf7: [584, 584], 0xf8: [611, 611],
  0xfe: [556, 611],
}

function buildTable(ascii: string, bold: boolean): number[] {
  const table = new Array<number>(256).fill(556)
  ascii.split(" ").forEach((w, i) => {
    table[32 + i] = Number(w)
  })
  for (const [byte, pair] of Object.entries(SPECIAL)) table[Number(byte)] = pair[bold ? 1 : 0]
  // Accented letters: same width as the base letter.
  for (let b = 0xc0; b <= 0xff; b++) {
    if (SPECIAL[b]) continue
    const base = String.fromCharCode(b).normalize("NFD").charCodeAt(0)
    if (base >= 32 && base <= 126) table[b] = table[base] ?? 556
  }
  for (const [cp, b] of [[0x160, 0x8a], [0x17d, 0x8e], [0x178, 0x9f], [0x161, 0x9a], [0x17e, 0x9e]] as const) {
    const base = String.fromCharCode(cp).normalize("NFD").charCodeAt(0)
    table[b] = table[base] ?? 556
  }
  return table
}

const TABLES: Record<FontName, number[]> = {
  regular: buildTable(REGULAR_ASCII, false),
  bold: buildTable(BOLD_ASCII, true),
}

/** Width of one WinAnsi byte, in 1/1000 em. */
export function byteWidth(byte: number, font: FontName): number {
  return TABLES[font][byte] ?? 556
}

/** Width of `text` in points at `size`. */
export function textWidth(text: string, font: FontName, size: number): number {
  let units = 0
  for (const b of encodeWinAnsi(text)) units += byteWidth(b, font)
  return (units * size) / 1000
}

/** PDF literal string `(...)` for WinAnsi bytes: escapes ( ) \ and writes anything non-printable as octal, so the output is pure ASCII. */
export function pdfLiteral(bytes: readonly number[]): string {
  let s = "("
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) s += "\\" + String.fromCharCode(b)
    else if (b >= 32 && b <= 126) s += String.fromCharCode(b)
    else s += "\\" + b.toString(8).padStart(3, "0")
  }
  return s + ")"
}
