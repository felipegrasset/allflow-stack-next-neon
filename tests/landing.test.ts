/**
 * Módulo `landing` (T9): `pnpm test:landing`.
 *
 * Cada prueba puede fallar: las invariantes (esquema estricto, copy completo,
 * bloques aislados, solo tokens, animación que no esconde, lead al CRM) se
 * rompen a propósito en los casos de abajo o se verificaron rompiéndolas.
 */
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { renderToStaticMarkup } from "react-dom/server"

import { copySets } from "../modules/landing/copy"
import landingJson from "../modules/landing/landing.json"
import {
  LandingError,
  parseLanding,
  resolveLanding,
  type ResolvedBlock,
} from "../modules/landing/resolve"
import { VARIANTS } from "../modules/landing/schema"
import { submitLead, type LeadDeps } from "../modules/landing/server/lead"
import {
  Landing,
  RenderBlock,
  landingVars,
} from "../modules/landing/ui/landing"

const ROOT = process.cwd()
const MOD = join(ROOT, "modules", "landing")
const vars = landingVars(2026)
const doc = () => parseLanding(structuredClone(landingJson))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any
const clone = <T>(v: T): T => structuredClone(v)
/**
 * React reparte ids (`_R_…_`) según la posición en el árbol y, al renderizar un
 * `<form action>`, agrega al final un <script> de reproducción: se quitan para comparar.
 */
const norm = (h: string) =>
  h.replace(/_R_[a-z0-9]+_/g, "_R_").replace(/<script>[\s\S]*?<\/script>/g, "")
const html = (b: ResolvedBlock) =>
  norm(renderToStaticMarkup(RenderBlock({ block: b })))

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

// ── 1 · el esquema de landing.json ───────────────────────────────────────────

test("landing.json es válido y trae los 9 bloques", () => {
  const d = doc()
  assert.deepEqual(
    d.blocks.map((b) => b.type),
    [
      "hero",
      "social",
      "features",
      "steps",
      "pricing",
      "faq",
      "lead",
      "cta",
      "footer",
    ]
  )
})

test("el esquema rechaza lo que no debe", () => {
  const bad = (mut: (d: Json) => void) => {
    const d = clone(landingJson) as Json
    mut(d)
    assert.throws(() => parseLanding(d), LandingError)
  }
  bad((d) => (d.blocks[0].variant = "nope"))
  bad((d) => (d.blocks[0].extra = 1))
  bad((d) => (d.blocks[1].id = d.blocks[0].id))
  bad((d) => (d.blocks[0].type = "carousel"))
  bad((d) => (d.blocks = []))
  bad((d) => (d.version = 2))
})

test("cada bloque tiene exactamente 2 variantes", () => {
  for (const [t, v] of Object.entries(VARIANTS)) assert.equal(v.length, 2, t)
})

// ── 2 · el copy ──────────────────────────────────────────────────────────────

test("el copy por defecto (es y en) resuelve todos los bloques con todas sus variantes", () => {
  for (const locale of ["es", "en"] as const) {
    for (const [type, variants] of Object.entries(VARIANTS)) {
      for (const variant of variants) {
        const d = parseLanding({
          version: 1,
          locale,
          blocks: [{ id: "b", type, variant, copy: type }],
        })
        const [b] = resolveLanding(d, copySets[locale], vars)
        assert.equal(b.variant, variant)
      }
    }
  }
})

test("{app} y {year} se interpolan y no quedan llaves sueltas", () => {
  const blocks = resolveLanding(doc(), copySets.es, vars)
  const all = blocks.map(html).join("")
  assert.ok(all.includes("© 2026"))
  assert.ok(!/\{(app|year)\}/.test(all))
})

test("una clave de copy ausente falla nombrando al bloque", () => {
  const copy = clone(copySets.es)
  delete copy.faq
  assert.throws(
    () => resolveLanding(doc(), copy, vars),
    (e: LandingError) =>
      e.issues.some((m) => m.includes("«faq»") && m.includes("clave"))
  )
})

test("un texto más largo que su tope (altura constante) falla", () => {
  const copy = clone(copySets.es) as Json
  copy.features.items[0].body = "x".repeat(121)
  assert.throws(
    () => resolveLanding(doc(), copy, vars),
    (e: LandingError) => e.issues.some((m) => m.includes("«features»"))
  )
})

test("una variante sin su campo falla (social/stats sin stats)", () => {
  const copy = clone(copySets.es) as Json
  delete copy.social.stats
  assert.throws(
    () => resolveLanding(doc(), copy, vars),
    (e: LandingError) => e.issues.some((m) => m.includes("necesita stats"))
  )
})

// ── 3 · LND-6: cambiar un bloque no rompe los demás ─────────────────────────

test("LND-6: cambiar la variante o el copy de un bloque solo cambia ese bloque", () => {
  const base = resolveLanding(doc(), copySets.es, vars)
  const baseHtml = new Map(base.map((b) => [b.id, html(b)]))

  for (const target of base) {
    const alt = (VARIANTS[target.type] as readonly string[]).find(
      (v) => v !== target.variant
    )!
    const d = doc()
    const ref = d.blocks.find((b) => b.id === target.id)!
    ref.variant = alt
    // el copy de `social/logos` ya trae logos; `hero/centered` ya trae secondary
    const changed = resolveLanding(d, copySets.es, vars)
    for (const b of changed) {
      if (b.id === target.id)
        assert.notEqual(html(b), baseHtml.get(b.id), `${b.id} debía cambiar`)
      else
        assert.equal(
          html(b),
          baseHtml.get(b.id),
          `${b.id} cambió al tocar ${target.id}`
        )
    }
  }
})

test("LND-6: la landing completa es la suma de sus bloques, cada uno con su marca", () => {
  const blocks = resolveLanding(doc(), copySets.es, vars)
  const page = norm(renderToStaticMarkup(Landing({ blocks })))
  for (const b of blocks) {
    assert.ok(page.includes(html(b)), `${b.id} no aparece intacto en la página`)
    assert.match(
      html(b),
      new RegExp(`data-block="${b.type}"[^>]*data-variant="${b.variant}"`)
    )
  }
  assert.equal((page.match(/<h1[ >]/g) ?? []).length, 1, "un solo h1")
})

test("LND-6: ningún bloque importa a otro bloque", () => {
  const dir = join(MOD, "ui", "blocks")
  for (const f of readdirSync(dir)) {
    const src = readFileSync(join(dir, f), "utf8")
    assert.ok(
      !/from\s+["']\.\/[a-z]/.test(src),
      `${f} importa un bloque hermano`
    )
  }
})

// ── 4 · LND-3: solo tokens ───────────────────────────────────────────────────

test("LND-3: sin colores literales ni paletas de Tailwind en el módulo", () => {
  const files = walk(MOD).filter((f) => /\.(tsx|css)$/.test(f))
  assert.ok(files.length > 10)
  const hex = /#[0-9a-fA-F]{3,8}\b/
  const fn = /\b(oklch|oklab|rgba?|hsla?|lab|lch|color-mix)\(/
  const palette =
    /\b(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|shadow)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|black|white)\b/
  for (const f of files) {
    const src = readFileSync(f, "utf8")
    for (const re of [hex, fn, palette])
      assert.ok(
        !re.test(src),
        `${f.replace(ROOT, "")} usa un color fuera de los tokens (${re})`
      )
  }
})

// ── 5 · el hero nunca queda vacío ────────────────────────────────────────────

test("la animación de entrada no esconde nada si falla", () => {
  const css = readFileSync(join(MOD, "ui", "landing.css"), "utf8")
  const noKeyframes = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@keyframes[^{]+\{(?:[^{}]|\{[^{}]*\})*\}/g, "")
  assert.ok(
    !/opacity\s*:\s*0/.test(noKeyframes),
    "opacity: 0 fuera de los keyframes"
  )
  assert.ok(!/visibility\s*:\s*hidden|display\s*:\s*none/.test(noKeyframes))
  // toda regla `animation:` usa `backwards` (estado inicial solo mientras corre)
  for (const m of noKeyframes.matchAll(/animation\s*:([^;]+);/g))
    assert.match(m[1], /backwards/)
  // y solo con movimiento permitido
  assert.match(css, /prefers-reduced-motion:\s*no-preference/)
})

test("el hero se renderiza completo en el servidor, sin JS ni clases de ocultar", () => {
  const blocks = resolveLanding(doc(), copySets.es, vars)
  const hero = html(blocks[0])
  assert.match(hero, /<h1[^>]*>[^<]+<\/h1>/)
  assert.ok(hero.includes((copySets.es.hero as { subtitle: string }).subtitle))
  assert.ok(
    !/class="(?:[^"]*\s)?(?:hidden|invisible|opacity-0)(?:\s[^"]*)?"/.test(hero)
  )
  assert.ok(
    !readFileSync(join(MOD, "ui", "blocks", "hero.tsx"), "utf8").includes(
      '"use client"'
    )
  )
})

// ── 6 · LND-5: el lead llega al CRM ─────────────────────────────────────────

type Call = { url: string; init: RequestInit }
function deps(
  over: Partial<LeadDeps> & { respond?: (url: string) => Response } = {}
) {
  const calls: Call[] = []
  const d: LeadDeps = {
    env: {
      ALLFLOW_INGEST_URL: "https://crm.test/api/ingest/v1/",
      ALLFLOW_INGEST_KEY: "afk_test",
    },
    now: () => new Date("2026-11-10T12:00:00Z"),
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init })
      return over.respond
        ? over.respond(String(url))
        : new Response("{}", { status: 201 })
    }) as typeof fetch,
    ...over,
  }
  return { d, calls }
}
const good = {
  name: "Ana",
  email: "ana@example.com",
  message: "hola",
  consent: true,
  utm_source: "ig",
  landing: "/",
}

test("LND-5: un lead válido hace POST a <base>/contacts con la llave y el cuerpo de la ingesta", async () => {
  const { d, calls } = deps()
  assert.deepEqual(await submitLead(good, d), { ok: true })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, "https://crm.test/api/ingest/v1/contacts")
  assert.equal(
    (calls[0].init.headers as Record<string, string>).Authorization,
    "Bearer afk_test"
  )
  const body = JSON.parse(String(calls[0].init.body))
  assert.equal(body.email, "ana@example.com")
  assert.equal(body.source, "landing")
  assert.equal(body.utm_source, "ig")
  assert.equal(body.attributes.consent, true)
  assert.equal(body.attributes.consent_at, "2026-11-10T12:00:00.000Z")
  // la ingesta responde 400 a estos campos: nunca deben viajar
  for (const k of [
    "org_id",
    "project_id",
    "stage",
    "consent",
    "captchaToken",
    "website",
  ])
    assert.ok(!(k in body), `${k} no debe ir en el cuerpo`)
})

test("LND-5: sin consentimiento no se manda nada", async () => {
  const { d, calls } = deps()
  assert.deepEqual(await submitLead({ ...good, consent: undefined }, d), {
    ok: false,
    reason: "consent",
  })
  assert.deepEqual(await submitLead({ ...good, consent: false }, d), {
    ok: false,
    reason: "consent",
  })
  assert.equal(calls.length, 0)
})

test("LND-5: honeypot lleno responde ok pero no manda nada", async () => {
  const { d, calls } = deps()
  assert.deepEqual(await submitLead({ ...good, website: "http://spam" }, d), {
    ok: true,
  })
  assert.equal(calls.length, 0)
})

test("LND-5: correo inválido no se manda", async () => {
  const { d, calls } = deps()
  assert.deepEqual(await submitLead({ ...good, email: "nope" }, d), {
    ok: false,
    reason: "invalid",
  })
  assert.equal(calls.length, 0)
})

test("LND-5: Turnstile solo se exige y verifica si hay clave secreta", async () => {
  // sin clave: ni se verifica
  const a = deps()
  assert.deepEqual(await submitLead(good, a.d), { ok: true })
  assert.ok(!a.calls.some((c) => c.url.includes("turnstile")))

  // con clave y sin token: rechazado, sin tocar el CRM
  const env = { ...a.d.env, TURNSTILE_SECRET_KEY: "sec" }
  const b = deps({ env })
  assert.deepEqual(await submitLead(good, b.d), {
    ok: false,
    reason: "captcha",
  })
  assert.equal(b.calls.length, 0)

  // con clave y token malo
  const c = deps({
    env,
    respond: (u) =>
      u.includes("turnstile")
        ? Response.json({ success: false })
        : new Response("{}", { status: 201 }),
  })
  assert.deepEqual(await submitLead({ ...good, captchaToken: "t" }, c.d), {
    ok: false,
    reason: "captcha",
  })
  assert.ok(!c.calls.some((x) => x.url.includes("/contacts")))

  // con clave y token bueno
  const e = deps({
    env,
    respond: (u) =>
      u.includes("turnstile")
        ? Response.json({ success: true })
        : new Response("{}", { status: 201 }),
  })
  assert.deepEqual(await submitLead({ ...good, captchaToken: "t" }, e.d), {
    ok: true,
  })
  assert.ok(e.calls.some((x) => x.url.endsWith("/contacts")))
})

test("LND-5: sin llave de ingesta o con el CRM caído no se finge éxito", async () => {
  const a = deps({ env: {} })
  assert.deepEqual(await submitLead(good, a.d), {
    ok: false,
    reason: "unavailable",
  })
  const b = deps({ respond: () => new Response("{}", { status: 401 }) })
  assert.deepEqual(await submitLead(good, b.d), {
    ok: false,
    reason: "upstream",
  })
  const c = deps({
    fetch: (async () => {
      throw new Error("red")
    }) as typeof fetch,
  })
  assert.deepEqual(await submitLead(good, c.d), {
    ok: false,
    reason: "upstream",
  })
})

test("el bloque lead pide consentimiento, lleva honeypot y monta Turnstile solo con clave", () => {
  const blocks = resolveLanding(doc(), copySets.es, vars)
  const lead = blocks.find((b) => b.type === "lead")!
  const prev = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  try {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    const without = html(lead)
    assert.match(
      without,
      /<input[^>]*name="consent"[^>]*required|<input[^>]*required[^>]*name="consent"/
    )
    assert.match(without, /name="website"/)
    assert.ok(!without.includes("min-h-[65px]"), "sin clave no hay widget")
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA"
    assert.ok(html(lead).includes("min-h-[65px]"), "con clave sí")
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = prev
  }
})
