import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

import { kitGroups } from "../modules/kits-galeria/ui/catalogo"

const MODULES = join(import.meta.dirname, "..", "modules")
const installed = readdirSync(MODULES)
  .filter(
    (n) =>
      /^kit-[a-z0-9-]+$/.test(n) &&
      n !== "kit-core" &&
      existsSync(join(MODULES, n, "manifest.json"))
  )
  .map((n) => n.slice("kit-".length))
  .sort()

const listed = kitGroups.flatMap((g) => g.kits)

test("la galería lista exactamente los kits instalados", () => {
  assert.deepEqual(listed.map((k) => k.slug).sort(), installed)
})

test("cada entrada coincide con la ruta de su manifiesto y no se repite", () => {
  assert.equal(new Set(listed.map((k) => k.slug)).size, listed.length)
  for (const k of listed) {
    const m = JSON.parse(
      readFileSync(join(MODULES, `kit-${k.slug}`, "manifest.json"), "utf8")
    ) as { routes?: { path: string }[] }
    assert.ok(
      m.routes?.some((r) => r.path === `/kits/${k.slug}`),
      `kit-${k.slug} no declara /kits/${k.slug}`
    )
  }
})
