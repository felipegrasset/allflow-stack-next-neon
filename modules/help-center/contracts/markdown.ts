/**
 * Minimal, safe markdown. The parser produces a small tree of plain data and
 * the UI maps it to React elements: there is no HTML anywhere, so raw HTML in
 * the source is just text (React escapes it) and nothing can inject a script.
 *
 * Blocks: `#`/`##` heading (level 2), `###` heading (level 3), paragraphs,
 * `-`/`*` lists, `1.` lists, `>` quotes and ``` fenced code.
 * Inline: **bold**, *italic*, `code` and [text](url). Links are limited to
 * http(s), mailto and site-relative paths; any other scheme (javascript:,
 * data:…) is rendered as its plain text. No images, no tables, no raw HTML.
 * Pure: no imports.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "link"; href: string; external: boolean; children: Inline[] }

export type Block =
  | { type: "heading"; level: 2 | 3; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "quote"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "code"; text: string }

const MAX_DEPTH = 3

/** The href if it is safe to put in an <a>, else null. */
export function safeHref(raw: string): { href: string; external: boolean } | null {
  const url = raw.trim()
  if (!url || url.length > 2000) return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000- \u007f-\u009f\\]/.test(url)) return null
  if (/^\/(?![/\\])/.test(url)) return { href: url, external: false }
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(url)) return { href: url, external: true }
  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url)
      if (u.protocol === "http:" || u.protocol === "https:") return { href: u.toString(), external: true }
    } catch {
      return null
    }
  }
  return null
}

const LINK_RE = /^\[([^\]\n]{1,300})\]\(([^)\s]{1,2000})\)/

export function parseInline(src: string, depth = 0): Inline[] {
  const out: Inline[] = []
  let buf = ""
  const flush = () => {
    if (buf) out.push({ type: "text", text: buf })
    buf = ""
  }
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === "`") {
      const end = src.indexOf("`", i + 1)
      if (end > i + 1) {
        flush()
        out.push({ type: "code", text: src.slice(i + 1, end) })
        i = end + 1
        continue
      }
    } else if (depth < MAX_DEPTH && c === "*" && src[i + 1] === "*") {
      const end = src.indexOf("**", i + 2)
      if (end > i + 2) {
        flush()
        out.push({ type: "strong", children: parseInline(src.slice(i + 2, end), depth + 1) })
        i = end + 2
        continue
      }
    } else if (depth < MAX_DEPTH && c === "*" && src[i + 1] !== " " && src[i + 1] !== undefined) {
      const end = src.indexOf("*", i + 1)
      if (end > i + 1 && src[end - 1] !== " ") {
        flush()
        out.push({ type: "em", children: parseInline(src.slice(i + 1, end), depth + 1) })
        i = end + 1
        continue
      }
    } else if (depth < MAX_DEPTH && c === "[") {
      const m = LINK_RE.exec(src.slice(i))
      if (m) {
        flush()
        const safe = safeHref(m[2])
        const children = parseInline(m[1], depth + 1)
        if (safe) out.push({ type: "link", href: safe.href, external: safe.external, children })
        else out.push(...children)
        i += m[0].length
        continue
      }
    }
    buf += c
    i++
  }
  flush()
  return out
}

const HEADING_RE = /^(#{1,3})\s+(.+)$/
const UL_RE = /^\s*[-*]\s+(.+)$/
const OL_RE = /^\s*\d{1,3}[.)]\s+(.+)$/
const QUOTE_RE = /^>\s?(.*)$/

export function parseBody(body: string): Block[] {
  const lines = body.replace(/\r\n?/g, "\n").split("\n")
  const blocks: Block[] = []
  let para: string[] = []
  const flushPara = () => {
    if (para.length) blocks.push({ type: "paragraph", children: parseInline(para.join(" ")) })
    para = []
  }
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^```/.test(line)) {
      flushPara()
      const code: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++])
      i++ // closing fence (or end of input)
      blocks.push({ type: "code", text: code.join("\n") })
      continue
    }
    if (line.trim() === "") {
      flushPara()
      i++
      continue
    }
    const h = HEADING_RE.exec(line)
    if (h) {
      flushPara()
      blocks.push({ type: "heading", level: h[1].length >= 3 ? 3 : 2, children: parseInline(h[2].trim()) })
      i++
      continue
    }
    const listRe = UL_RE.test(line) ? UL_RE : OL_RE.test(line) ? OL_RE : null
    if (listRe) {
      flushPara()
      const items: Inline[][] = []
      while (i < lines.length) {
        const m = listRe.exec(lines[i])
        if (!m) break
        items.push(parseInline(m[1].trim()))
        i++
      }
      blocks.push({ type: "list", ordered: listRe === OL_RE, items })
      continue
    }
    const q = QUOTE_RE.exec(line)
    if (q) {
      flushPara()
      const parts: string[] = []
      while (i < lines.length) {
        const m = QUOTE_RE.exec(lines[i])
        if (!m) break
        parts.push(m[1])
        i++
      }
      blocks.push({ type: "quote", children: parseInline(parts.join(" ").trim()) })
      continue
    }
    para.push(line.trim())
    i++
  }
  flushPara()
  return blocks
}

function inlineText(nodes: Inline[]): string {
  return nodes
    .map((n) => (n.type === "text" || n.type === "code" ? n.text : inlineText(n.children)))
    .join("")
}

/** The body without markup, for excerpts and search ranking. */
export function toPlainText(body: string): string {
  return parseBody(body)
    .map((b) => {
      if (b.type === "code") return b.text
      if (b.type === "list") return b.items.map(inlineText).join(" ")
      return inlineText(b.children)
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}
