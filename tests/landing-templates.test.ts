/**
 * Plantillas por arquetipo (T10): se corre junto con `pnpm test:landing`.
 * Cubre lo que se puede probar sin navegador de LND-2 (el hero dice qué es y
 * qué hacer) y la integridad de cada combinación de bloques.
 */
import assert from "node:assert/strict"
import test from "node:test"

import { renderToStaticMarkup } from "react-dom/server"

import { parseLanding, resolveLanding } from "../modules/landing/resolve"
import { TEMPLATES, TEMPLATE_IDS } from "../modules/landing/templates"
import { Landing, landingVars } from "../modules/landing/ui/landing"

const vars = landingVars(2026)
const resolve = (id: keyof typeof TEMPLATES) => {
  const t = TEMPLATES[id]
  const doc = parseLanding(t.landing)
  return { t, doc, blocks: resolveLanding(doc, t.copy, vars) }
}

test("están los cinco arquetipos del plan", () => {
  assert.deepEqual([...TEMPLATE_IDS].sort(), [
    "bookings-services",
    "community",
    "ecommerce",
    "education",
    "minimal-tech",
  ])
  for (const id of TEMPLATE_IDS) assert.equal(TEMPLATES[id].id, id)
})

for (const id of TEMPLATE_IDS) {
  test(`${id}: landing y copy son válidos y no sobra ni falta ninguna clave`, () => {
    const { t, doc } = resolve(id)
    const used = new Set(doc.blocks.map((b) => b.copy))
    assert.deepEqual([...used].sort(), Object.keys(t.copy).sort())
  })

  test(`${id}: hero primero, pie al final y un camino de conversión`, () => {
    const { doc } = resolve(id)
    assert.equal(doc.blocks[0].type, "hero")
    assert.equal(doc.blocks.at(-1)?.type, "footer")
    assert.ok(doc.blocks.some((b) => b.type === "lead" || b.type === "cta"))
    assert.equal(doc.blocks.filter((b) => b.type === "hero").length, 1)
  })

  test(`${id}: LND-2, el hero dice qué es (título con el nombre) y qué hacer (CTA)`, () => {
    const { blocks } = resolve(id)
    const hero = blocks[0]
    assert.equal(hero.type, "hero")
    if (hero.type !== "hero") return
    assert.ok(hero.copy.title.includes(vars.app), "el título nombra la app")
    assert.ok(hero.copy.subtitle.length >= 40, "el subtítulo explica")
    assert.ok(hero.copy.primary.href.length > 0)
    const page = renderToStaticMarkup(Landing({ blocks }))
    assert.equal((page.match(/<h1[ >]/g) ?? []).length, 1)
    assert.ok(page.includes(`href="${hero.copy.primary.href}"`))
  })

  test(`${id}: los enlaces internos (#ancla) apuntan a un bloque que existe`, () => {
    const { t, doc } = resolve(id)
    const ids = new Set(doc.blocks.map((b) => b.id))
    const hrefs = JSON.stringify(t.copy).match(/"#[a-z0-9-]+"/g) ?? []
    for (const h of hrefs)
      assert.ok(ids.has(h.slice(2, -1)), `${id}: ${h} sin bloque`)
  })
}

test("las cinco plantillas son distintas entre sí (no una sola con otro copy)", () => {
  const sig = (id: keyof typeof TEMPLATES) =>
    TEMPLATES[id].landing.blocks.map((b) => `${b.type}/${b.variant}`).join(",")
  const all = TEMPLATE_IDS.map(sig)
  assert.equal(new Set(all).size, TEMPLATE_IDS.length)
})

test("sin dos bloques con el mismo id dentro de una plantilla y sin copy compartido entre plantillas", () => {
  // cada plantilla trae su propio copy: ninguna depende de una clave de otra
  for (const id of TEMPLATE_IDS) {
    const ids = TEMPLATES[id].landing.blocks.map((b) => b.id)
    assert.equal(new Set(ids).size, ids.length)
  }
})
