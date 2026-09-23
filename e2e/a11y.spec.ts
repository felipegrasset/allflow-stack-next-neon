import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

/**
 * WCAG 2.2 AA with axe, in light AND dark (the brand tokens must hold contrast
 * in both). T1 has few routes; T2 adds the rest of the floor's screens here.
 */
const rutas = ["/", "/login", "/signup", "/check-email?email=ana%40example.com"]

for (const ruta of rutas) {
  for (const esquema of ["light", "dark"] as const) {
    test(`a11y ${ruta} (${esquema})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: esquema })
      await page.goto(ruta)
      await expect(page.locator("html")).toHaveClass(esquema === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/)
      const r = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(r.violations).toEqual([])
    })
  }
}

test("a11y /signup with field errors (dark)", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/signup")
  await page.getByRole("button", { name: "Crear cuenta" }).click()
  await expect(page.getByText("El correo es obligatorio")).toBeVisible()
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()
  expect(r.violations).toEqual([])
})
