import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { test } from "@playwright/test"

import { expectKitAccessible } from "../modules/kit-core/testing/axe"

/**
 * Vista previa de cada kit (`modules/kit-*`): axe WCAG 2.2 AA en claro y oscuro,
 * a 1280 y a 375 px, sin desborde horizontal. Sale de los manifiestos: un kit
 * nuevo queda cubierto sin tocar este archivo. No necesita sesión.
 */
const MODULES = join(import.meta.dirname, "..", "modules")
const kits = readdirSync(MODULES).filter(
  (n) =>
    /^kits?-[a-z0-9-]+$/.test(n) && existsSync(join(MODULES, n, "manifest.json"))
)

for (const id of kits) {
  const manifest = JSON.parse(
    readFileSync(join(MODULES, id, "manifest.json"), "utf8")
  ) as {
    routes?: { path: string }[]
  }
  for (const r of manifest.routes ?? []) {
    test(`${id}: ${r.path} pasa axe y no desborda`, async ({ page }) => {
      await expectKitAccessible(page, r.path, id)
    })
  }
}
