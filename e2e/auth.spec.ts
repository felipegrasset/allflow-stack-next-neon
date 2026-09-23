import { readFileSync, existsSync } from "node:fs"
import { expect, test, type Page } from "@playwright/test"

import { OUTBOX } from "../playwright.config"

/** Polls the dev outbox for the latest email to `to` and returns its first link. */
async function linkFor(to: string, subject: RegExp): Promise<string> {
  for (let i = 0; i < 50; i++) {
    if (existsSync(OUTBOX)) {
      const mails = readFileSync(OUTBOX, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as { to: string; subject: string; text: string })
        .filter((m) => m.to === to && subject.test(m.subject))
      const last = mails.at(-1)
      const url = last?.text.match(/https?:\/\/\S+/)?.[0]
      if (url) return url
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`No llegó ningún correo a ${to}`)
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Cerrar sesión" }).click()
  await expect(page).toHaveURL(/\/login$/)
}

test("registro → verificación → logout → login → logout", async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
  const password = "una-clave-larga-123"

  await page.goto("/signup")
  await page.getByLabel("Nombre").fill("Ana Prueba")
  await page.getByLabel("Correo electrónico").fill(email)
  await page.getByLabel("Contraseña").fill(password)
  await page.getByRole("button", { name: "Crear cuenta" }).click()
  await expect(page).toHaveURL(/\/check-email/)
  await expect(page.getByText(email)).toBeVisible()

  // Unverified login is refused (and re-sends the link).
  await page.goto("/login")
  await page.getByLabel("Correo electrónico").fill(email)
  await page.getByLabel("Contraseña").fill(password)
  await page.getByRole("button", { name: "Entrar" }).click()
  await expect(page.locator("[data-slot=alert][role=alert]")).toContainText("confirmas tu correo")

  // The verification link signs the user in (autoSignInAfterVerification).
  await page.goto(await linkFor(email, /Confirma tu correo/))
  await expect(page.getByTestId("session-email")).toContainText(email)
  await logout(page)

  await page.getByLabel("Correo electrónico").fill(email)
  await page.getByLabel("Contraseña").fill(password)
  await page.getByRole("button", { name: "Entrar" }).click()
  await expect(page.getByTestId("session-email")).toContainText(email)
  await logout(page)

  // Signed out for real: home offers login again.
  await page.goto("/")
  await expect(page.getByTestId("session-email")).toHaveCount(0)
})

test("login con contraseña incorrecta muestra el error de formulario", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Correo electrónico").fill("nadie@example.com")
  await page.getByLabel("Contraseña").fill("incorrecta-123")
  await page.getByRole("button", { name: "Entrar" }).click()
  await expect(page.locator("[data-slot=alert][role=alert]")).toContainText("Correo o contraseña incorrectos")
})
