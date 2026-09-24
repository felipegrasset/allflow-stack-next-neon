import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { STATE } from "./helpers"

/**
 * WCAG 2.2 AA with axe, in light AND dark (the brand tokens must hold contrast
 * in both), over every screen of the floor: public, signed-in, admin, and the
 * 403 / 404 / error states.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]
const SCHEMES = ["light", "dark"] as const

async function expectNoViolations(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(r.violations).toEqual([])
}

async function open(page: Page, ruta: string, esquema: (typeof SCHEMES)[number], ready?: (page: Page) => Promise<void>) {
  await page.emulateMedia({ colorScheme: esquema })
  await page.goto(ruta)
  await expect(page.locator("html")).toHaveClass(esquema === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/)
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
  if (ready) await ready(page)
}

type Ruta = { ruta: string; ready?: (page: Page) => Promise<void> }

const publicas: Ruta[] = [
  { ruta: "/" },
  { ruta: "/login" },
  { ruta: "/signup" },
  { ruta: "/verify-email?email=ana%40example.com" },
  { ruta: "/verify-email" },
  {
    ruta: "/verify-email/token-que-no-sirve",
    ready: (p) => expect(p.getByRole("heading", { name: "El enlace no es válido" })).toBeVisible(),
  },
  { ruta: "/forgot-password" },
  {
    ruta: "/reset-password/token-que-no-existe",
    ready: (p) => expect(p.getByRole("heading", { name: /no es válido o venció/ })).toBeVisible(),
  },
  { ruta: "/esta-ruta-no-existe", ready: (p) => expect(p.getByRole("heading", { name: "Página no encontrada" })).toBeVisible() },
]

const conSesion: { state: string; rutas: Ruta[] }[] = [
  {
    state: STATE.admin,
    rutas: [
      { ruta: "/" },
      { ruta: "/settings/profile" },
      { ruta: "/settings/security" },
      { ruta: "/admin/users", ready: (p) => expect(p.getByTestId("member-row").first()).toBeVisible() },
    ],
  },
  {
    state: STATE.member,
    rutas: [
      { ruta: "/admin/users", ready: (p) => expect(p.getByRole("heading", { name: /No tienes acceso/ })).toBeVisible() },
    ],
  },
  {
    state: STATE.pending,
    rutas: [{ ruta: "/onboarding", ready: (p) => expect(p.getByRole("progressbar")).toBeVisible() }],
  },
]

for (const { ruta, ready } of publicas) {
  for (const esquema of SCHEMES) {
    test(`a11y ${ruta} (${esquema})`, async ({ page }) => {
      await open(page, ruta, esquema, ready)
      await expectNoViolations(page)
    })
  }
}

for (const { state, rutas } of conSesion) {
  test.describe(() => {
    test.use({ storageState: state })
    for (const { ruta, ready } of rutas) {
      for (const esquema of SCHEMES) {
        test(`a11y ${ruta} con sesión ${state.split("/").at(-1)?.replace(".json", "")} (${esquema})`, async ({ page }) => {
          await open(page, ruta, esquema, ready)
          await expectNoViolations(page)
        })
      }
    }
  })
}

// ── States, not just pages ─────────────────────────────────────────────────

for (const esquema of SCHEMES) {
  test(`a11y /signup con errores por campo (${esquema})`, async ({ page }) => {
    await open(page, "/signup", esquema)
    await page.getByRole("button", { name: "Crear cuenta" }).click()
    await expect(page.getByText("El correo es obligatorio")).toBeVisible()
    await expectNoViolations(page)
  })

  test(`a11y /login con error de formulario y magic link (${esquema})`, async ({ page }) => {
    await open(page, "/login", esquema)
    await page.getByLabel("Correo electrónico").fill(`nadie-${Date.now()}@example.com`)
    await page.getByLabel("Contraseña", { exact: true }).fill("incorrecta-123")
    await page.getByRole("button", { name: "Entrar", exact: true }).click()
    await expect(page.locator("[data-slot=alert][role=alert]")).toBeVisible()
    await expectNoViolations(page)
    await page.getByRole("button", { name: "Entrar con un enlace por correo" }).click()
    await expect(page.getByRole("button", { name: "Enviarme un enlace" })).toBeVisible()
    await expectNoViolations(page)
  })
}

test.describe(() => {
  test.use({ storageState: STATE.admin })
  for (const esquema of SCHEMES) {
    test(`a11y diálogo de cambios sin guardar (${esquema})`, async ({ page }) => {
      await open(page, "/settings/profile", esquema)
      await page.getByLabel("Nombre").fill("Nombre a medio editar")
      await page.getByRole("link", { name: "Seguridad" }).click()
      await expect(page.getByRole("alertdialog")).toBeVisible()
      await expectNoViolations(page)
    })
  }
})
