/**
 * La parte de la rúbrica que se mide en el navegador (Playwright): contraste
 * WCAG 2.2 AA con axe en claro y oscuro, y que a 375 px no haya desborde
 * horizontal. Además guarda capturas a 1280 y 375 px en `test-results/kit-shots/`
 * para la revisión humana de los otros seis puntos.
 *
 * Uso (en un spec de e2e): `await expectKitAccessible(page, "/kits/<nombre>", "<nombre>")`.
 */
import AxeBuilder from "@axe-core/playwright"
import { expect, type Page } from "@playwright/test"

export const KIT_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]
export const KIT_VIEWPORTS = [
  { name: "1280", width: 1280, height: 800 },
  { name: "375", width: 375, height: 812 },
] as const
export const KIT_SCHEMES = ["light", "dark"] as const

export async function expectKitAccessible(
  page: Page,
  route: string,
  name: string
) {
  for (const vp of KIT_VIEWPORTS) {
    for (const scheme of KIT_SCHEMES) {
      const where = `${name} @${vp.name}px ${scheme}`
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" })
      await page.goto(route)
      await expect(page.locator("html"), where).toHaveClass(
        scheme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/
      )
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
        where
      ).toBeVisible()

      const r = await new AxeBuilder({ page }).withTags(KIT_TAGS).analyze()
      expect(
        r.violations.map(
          (v) =>
            `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`
        ),
        `axe ${where}`
      ).toEqual([])

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      )
      // Si desborda, el mensaje nombra qué elementos se pasan del borde derecho.
      const culprits =
        overflow > 0
          ? await page.evaluate(() =>
              [...document.querySelectorAll("body *")]
                .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5)
                .slice(0, 8)
                .map((el) => {
                  const r = el.getBoundingClientRect()
                  return `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} right=${Math.round(r.right)} w=${Math.round(r.width)}`
                })
            )
          : []
      expect(
        overflow,
        `desborde horizontal ${where}${culprits.length ? ` — ${culprits.join(" | ")}` : ""}`
      ).toBeLessThanOrEqual(0)

      await page.screenshot({
        path: `test-results/kit-shots/${name}-${vp.name}-${scheme}.png`,
        fullPage: true,
      })
    }
  }
}
