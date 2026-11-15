/**
 * help-center v0.1 — what runs WITHOUT a database: the safe markdown (the
 * XSS cases), slugs, the Zod schemas, search helpers, the visitor hash, the
 * catalog (es/en parity), the manifest/permissions and, reading the code, that
 * every editor action checks session + permission first and that nothing
 * renders raw HTML. Relative imports only, so it runs transpiled without `@/`.
 */
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { articleSchemas, slugify } from "../contracts/input"
import { parseBody, parseInline, safeHref, toPlainText } from "../contracts/markdown"
import { escapeLike, groupByCategory, likePattern, matchRank, rankArticles } from "../contracts/search"
import { en, es } from "../messages"
import { permissions } from "../permissions"
import { VOTER_COOKIE, ensureToken, hashVoter } from "../server/voter"

const DIR = join(process.cwd(), "modules/help-center")
const read = (rel: string) => readFileSync(join(DIR, rel), "utf8")

// ── markdown ─────────────────────────────────────────────────────────────────

test("safeHref allows http(s), mailto and site paths only", () => {
  assert.deepEqual(safeHref("/ayuda/x"), { href: "/ayuda/x", external: false })
  assert.equal(safeHref("https://example.com/a")?.external, true)
  assert.equal(safeHref("mailto:ayuda@example.com")?.external, true)
  for (const bad of [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "data:text/html;base64,AAAA",
    "vbscript:x",
    "//evil.example",
    "/\\evil.example",
    "https://exa mple.com",
    "ftp://x.example",
    "",
    "java\nscript:alert(1)",
  ])
    assert.equal(safeHref(bad), null, JSON.stringify(bad))
})

test("raw HTML stays text: no node can carry markup", () => {
  const blocks = parseBody('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>')
  assert.equal(blocks.length, 2)
  const first = blocks[0]
  assert.ok(first.type === "paragraph")
  assert.deepEqual(first.children, [{ type: "text", text: "<script>alert(1)</script>" }])
})

test("a javascript: link loses its href and keeps its text", () => {
  const nodes = parseInline("[clic](javascript:alert(1))")
  assert.ok(nodes.every((n) => n.type === "text"))
  assert.equal(nodes.map((n) => (n.type === "text" ? n.text : "")).join("").startsWith("clic"), true)
  const ok = parseInline("[ayuda](https://example.com)")
  assert.equal(ok[0].type, "link")
})

test("inline: bold, italic, code and unmatched markers", () => {
  assert.deepEqual(parseInline("a **b** *c* `d`").map((n) => n.type), ["text", "strong", "text", "em", "text", "code"])
  assert.deepEqual(parseInline("2 * 3 * 4"), [{ type: "text", text: "2 * 3 * 4" }])
  assert.deepEqual(parseInline("**sin cierre"), [{ type: "text", text: "**sin cierre" }])
  // code content is not parsed
  assert.deepEqual(parseInline("`**x**`"), [{ type: "code", text: "**x**" }])
})

test("blocks: headings, lists, quote, fenced code, paragraphs", () => {
  const b = parseBody("# Uno\n### Tres\n\nTexto\ncontinúa\n\n- a\n- b\n\n1. x\n2) y\n\n> cita\n\n```\n**no**\n```")
  assert.deepEqual(
    b.map((x) => x.type),
    ["heading", "heading", "paragraph", "list", "list", "quote", "code"]
  )
  assert.equal(b[0].type === "heading" && b[0].level, 2)
  assert.equal(b[1].type === "heading" && b[1].level, 3)
  assert.equal(b[3].type === "list" && !b[3].ordered && b[3].items.length, 2)
  assert.equal(b[4].type === "list" && b[4].ordered, true)
  assert.equal(b[6].type === "code" && b[6].text, "**no**")
})

test("unclosed fence and huge nesting do not throw or loop", () => {
  assert.doesNotThrow(() => parseBody("```\nsin cierre"))
  assert.doesNotThrow(() => parseBody("**".repeat(5000) + "[" .repeat(5000)))
})

test("toPlainText drops the markup", () => {
  assert.equal(toPlainText("## Hola\n\nUn **gran** [enlace](/x)"), "Hola Un gran enlace")
})

// ── slug and schemas ─────────────────────────────────────────────────────────

test("slugify", () => {
  assert.equal(slugify("Cómo cambiar tu contraseña"), "como-cambiar-tu-contrasena")
  assert.equal(slugify("  ¡Hola, mundo!  "), "hola-mundo")
  assert.equal(slugify("???"), "")
  assert.ok(slugify("a".repeat(200)).length <= 80)
})

const base = { title: "Mi artículo", slug: "", summary: "", category: "", locale: "es", sortOrder: 0, body: "Texto", published: false }

test("articleSchema: slug from title, bad slug, empty and too long fields", () => {
  const { articleSchema } = articleSchemas()
  const ok = articleSchema.safeParse(base)
  assert.ok(ok.success && ok.data.slug === "mi-articulo")
  assert.equal(articleSchema.safeParse({ ...base, slug: "Con Espacios" }).success, false)
  assert.equal(articleSchema.safeParse({ ...base, slug: "-x" }).success, false)
  assert.equal(articleSchema.safeParse({ ...base, title: "???" }).success, false) // no slug derivable
  assert.equal(articleSchema.safeParse({ ...base, title: "  " }).success, false)
  assert.equal(articleSchema.safeParse({ ...base, body: "x".repeat(20001) }).success, false)
  assert.equal(articleSchema.safeParse({ ...base, locale: "fr" }).success, false)
  assert.equal(articleSchema.safeParse({ ...base, sortOrder: -1 }).success, false)
  assert.equal(articleSchema.safeParse({ ...base, sortOrder: NaN }).success, false)
})

test("feedbackSchema: yes/no only, slug shaped, comment capped", () => {
  const { feedbackSchema } = articleSchemas()
  assert.equal(feedbackSchema.safeParse({ slug: "primeros-pasos", helpful: "yes", comment: "" }).success, true)
  assert.equal(feedbackSchema.safeParse({ slug: "primeros-pasos", helpful: "maybe", comment: "" }).success, false)
  assert.equal(feedbackSchema.safeParse({ slug: "../x", helpful: "no", comment: "" }).success, false)
  assert.equal(feedbackSchema.safeParse({ slug: "x", helpful: "no", comment: "c".repeat(501) }).success, false)
})

// ── search ───────────────────────────────────────────────────────────────────

test("likePattern escapes wildcards and trims", () => {
  assert.equal(escapeLike("100%_\\"), "100\\%\\_\\\\")
  assert.equal(likePattern("  50%  off "), "%50\\% off%")
  assert.equal(likePattern("x".repeat(300)).length, 102)
})

test("rankArticles: title, then summary, then body; stable by order and title", () => {
  const mk = (title: string, summary: string | null, sortOrder = 0) => ({ title, summary, sortOrder })
  const items = [mk("Facturas", "pagos"), mk("Otro", "habla de contraseña"), mk("Contraseña", null), mk("Z", null, 5)]
  const out = rankArticles(items, "contraseña").map((i) => i.title)
  assert.deepEqual(out, ["Contraseña", "Otro", "Facturas", "Z"])
  assert.equal(matchRank(mk("a", null), ""), 3)
  assert.deepEqual(items.map((i) => i.title), ["Facturas", "Otro", "Contraseña", "Z"]) // input not mutated
})

test("groupByCategory keeps first-seen order and names the uncategorized", () => {
  const g = groupByCategory([{ category: "B" }, { category: null }, { category: "B" }, { category: " " }], "General")
  assert.deepEqual(g.map((x) => [x.category, x.items.length]), [["B", 2], ["General", 2]])
})

// ── visitor hash ─────────────────────────────────────────────────────────────

test("voter token: kept when well formed, replaced otherwise; only a hash is stored", () => {
  const first = ensureToken(undefined)
  assert.equal(first.isNew, true)
  assert.deepEqual(ensureToken(first.token), { token: first.token, isNew: false })
  assert.equal(ensureToken("forged'; drop table").isNew, true)
  const h = hashVoter(first.token)
  assert.match(h, /^[0-9a-f]{64}$/)
  assert.notEqual(h, first.token)
  assert.equal(h, hashVoter(first.token))
  assert.notEqual(h, hashVoter(ensureToken(undefined).token))
  assert.equal(VOTER_COOKIE, "help_center_voter")
})

// ── catalog, manifest, permissions ───────────────────────────────────────────

test("catalog: same keys in es and en, one top-level key = the module id", () => {
  const keys = (o: object, p = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [p + k] : keys(v, `${p}${k}.`)))
  assert.deepEqual(keys(en).sort(), keys(es).sort())
  assert.deepEqual(Object.keys(es), ["help-center"])
  const args = (s: string) => [...s.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]).sort().join()
  const flat = (o: object): Record<string, string> => Object.fromEntries(keys(o).map((k) => [k, k.split(".").reduce<unknown>((a, p) => (a as Record<string, unknown>)[p], o) as string]))
  const fe = flat(es), fn = flat(en)
  for (const k of Object.keys(fe)) assert.equal(args(fn[k]), args(fe[k]), k)
})

test("manifest: ids, tables with the prefix, public routes in marketing, covers", () => {
  const m = JSON.parse(read("manifest.json"))
  assert.equal(m.id, "help-center")
  assert.deepEqual(m.migrations, ["0117_help_center_init"])
  for (const t of m.tables) assert.match(t, /^help_center_/)
  const pub = m.routes.filter((r: { path: string }) => r.path.startsWith("/ayuda"))
  assert.equal(pub.length, 2)
  for (const r of pub) assert.equal(r.group, "marketing")
  assert.equal(new Set(m.covers.map((c: string) => c.toLowerCase())).size, m.covers.length)
  assert.equal(m.dependencies, undefined) // no npm package needed
})

test("permissions: article read/write; member only reads", () => {
  assert.deepEqual(permissions.statement, { article: ["read", "write"] })
  assert.deepEqual(permissions.grants.member, { article: ["read"] })
})

// ── source guards ────────────────────────────────────────────────────────────

test("source: editor actions check session + write permission before any data access", () => {
  const src = read("server/actions.ts")
  assert.match(src, /^"use server"/)
  const fns = src.split(/export async function /).slice(1)
  assert.equal(fns.length, 3)
  for (const f of fns) {
    const guard = f.indexOf('actionSession("/admin/help", "write")')
    assert.ok(guard > -1, f.slice(0, 30))
    for (const call of ["createArticle(", "updateArticle(", "setPublished(", "deleteArticle("])
      if (f.includes(call)) assert.ok(f.indexOf(call) > guard, call)
  }
  assert.match(src, /safeParse\(/)
})

test("source: the public feedback action is the only one without permission, and stores a hash", () => {
  const src = read("server/feedback-action.ts")
  assert.match(src, /^"use server"/)
  assert.match(src, /feedbackSchema\.safeParse\(/)
  assert.match(src, /hashVoter\(token\)/)
  assert.match(src, /import \{ clientIp, consume \} from "@\/server\/rate-limit"/)
  assert.ok(src.indexOf("consume(") > src.indexOf("safeParse(") && src.indexOf("consume(") < src.indexOf("recordFeedback("))
  assert.doesNotMatch(src, /voterHash: token/)
  const mut = read("server/mutations.ts")
  assert.match(mut, /where\("published", "=", true\)/)
})

test("source: nothing renders raw HTML and queries never build SQL from strings", () => {
  for (const f of readdirSync(join(DIR, "ui"))) assert.doesNotMatch(read(`ui/${f}`), /dangerouslySetInnerHTML|innerHTML/, f)
  for (const f of ["server/queries.ts", "server/mutations.ts"]) {
    const s = read(f).replace(/sql<Date>`(now\(\)|coalesce\(published_at, now\(\)\))`/g, "")
    assert.doesNotMatch(s, /sql`/, f)
  }
  assert.doesNotMatch(read("server/queries.ts"), /voter_hash/)
})

test("source: the editor and the admin list are behind article:read, the form behind write", () => {
  const page = read("ui/admin-page.tsx")
  assert.match(page, /requirePagePermission\("\/admin\/help", "read"\)/)
  assert.match(page, /canWrite/)
})
