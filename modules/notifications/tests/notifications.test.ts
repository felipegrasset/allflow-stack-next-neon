/**
 * notifications v0.1 — lo que se puede probar sin base de datos: la validación
 * de `notify` (sobre todo el enlace interno), el formato del contador y el
 * render estático de los componentes reciclables.
 */
import assert from "node:assert/strict"
import test from "node:test"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { INTERNAL_HREF, notifyInputSchema } from "../contracts/input"
import { copy } from "../copy"
import { CountBadge, formatCount } from "../ui/count-badge"
import { ItemList } from "../ui/item-list"

const base = { userId: "u1", title: "Hola" }

test("notify: entrada mínima válida, con kind 'info' por defecto", () => {
  const v = notifyInputSchema.parse(base)
  assert.equal(v.kind, "info")
  assert.equal(v.title, "Hola")
})

test("notify: recorta el título y rechaza el vacío o el demasiado largo", () => {
  assert.equal(notifyInputSchema.parse({ ...base, title: "  x  " }).title, "x")
  assert.equal(
    notifyInputSchema.safeParse({ ...base, title: "   " }).success,
    false
  )
  assert.equal(
    notifyInputSchema.safeParse({ ...base, title: "a".repeat(121) }).success,
    false
  )
  assert.equal(
    notifyInputSchema.safeParse({ ...base, body: "a".repeat(501) }).success,
    false
  )
})

test("notify: solo acepta enlaces internos", () => {
  for (const ok of ["/reports/42", "/", "/a?b=1#c"]) {
    assert.ok(INTERNAL_HREF.test(ok), ok)
    assert.equal(
      notifyInputSchema.safeParse({ ...base, href: ok }).success,
      true,
      ok
    )
  }
  for (const bad of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "reports/42",
    "/con espacio",
  ]) {
    const r = notifyInputSchema.safeParse({ ...base, href: bad })
    assert.equal(r.success, false, `debía rechazar ${bad}`)
  }
})

test("notify: rechaza un kind desconocido", () => {
  assert.equal(
    notifyInputSchema.safeParse({ ...base, kind: "pánico" }).success,
    false
  )
})

test("formatCount: satura en max+ y nunca es negativo", () => {
  assert.equal(formatCount(0), "0")
  assert.equal(formatCount(7), "7")
  assert.equal(formatCount(99), "99")
  assert.equal(formatCount(100), "99+")
  assert.equal(formatCount(12, 9), "9+")
  assert.equal(formatCount(-3), "0")
})

test("CountBadge: no pinta nada en 0, pinta el número y no usa colores literales", () => {
  assert.equal(
    renderToStaticMarkup(createElement(CountBadge, { count: 0 })),
    ""
  )
  const html = renderToStaticMarkup(createElement(CountBadge, { count: 150 }))
  assert.match(html, />99\+</)
  assert.match(html, /aria-hidden/)
  assert.match(html, /bg-primary/)
  assert.doesNotMatch(html, /#[0-9a-f]{3,8}|rgb\(|oklch\(/i)
})

test("ItemList: vacío muestra el estado vacío; con datos, una lista con nombre accesible", () => {
  const props = {
    getKey: (s: string) => s,
    renderItem: (s: string) => createElement("span", null, s),
    label: copy.page.listLabel,
    empty: copy.empty,
  }
  const vacia = renderToStaticMarkup(
    createElement(ItemList<string>, { ...props, items: [] })
  )
  assert.match(vacia, new RegExp(copy.empty.title))
  assert.doesNotMatch(vacia, /<ul/)
  const llena = renderToStaticMarkup(
    createElement(ItemList<string>, { ...props, items: ["a", "b"] })
  )
  assert.match(llena, new RegExp(`<ul[^>]*aria-label="${copy.page.listLabel}"`))
  assert.equal((llena.match(/<li/g) ?? []).length, 2)
})
