import { expect, test } from "@playwright/test"

import { expectToast, linkFor, login, logout, mailCount, signUp, skipOnboarding, uniqueEmail, users, verify } from "./helpers"

/** The auth kit: sign-up, verification, login (password / magic link), recovery, guards. */

test("registro → verificación → logout → login → logout", async ({ page }) => {
  const email = uniqueEmail("ciclo")
  const password = "una-clave-larga-123"

  await signUp(page, { name: "Ana Prueba", email, password })
  await expect(page.getByTestId("verify-email-address")).toHaveText(email)
  // The resend button starts in its 60 s cooldown, with a visible counter.
  await expect(page.getByRole("button", { name: /Podrás reenviar en \d+ s/ })).toBeDisabled()

  // Unverified login is refused (and re-sends the link).
  await login(page, email, password)
  await expect(page.locator("[data-slot=alert][role=alert]")).toContainText("confirmas tu correo")

  // The verification link signs the user in; "Continuar" → onboarding gate.
  await verify(page, email)
  await page.getByRole("link", { name: "Continuar" }).click()
  await expect(page).toHaveURL(/\/onboarding/)
  await skipOnboarding(page)
  await expect(page.getByTestId("session-email")).toContainText(email)
  await logout(page)

  await login(page, email, password)
  await expect(page.getByTestId("session-email")).toContainText(email)
  await logout(page)

  // Signed out for real: home offers login again.
  await page.goto("/")
  await expect(page.getByTestId("session-email")).toHaveCount(0)
})

test("registro con un correo ya usado: error en el campo, con foco", async ({ page }) => {
  const { member } = users()
  await page.goto("/signup")
  await page.getByLabel("Nombre").fill("Otra Persona")
  await page.getByLabel("Correo electrónico").fill(member.email)
  await page.getByLabel("Contraseña").fill("una-clave-larga-123")
  await page.getByRole("button", { name: "Crear cuenta" }).click()
  const emailInput = page.getByLabel("Correo electrónico")
  await expect(page.getByText("Ese correo ya está registrado.")).toBeVisible()
  await expect(emailInput).toBeFocused()
  await expect(emailInput).toHaveAttribute("aria-invalid", "true")
  await expect(emailInput).toHaveAttribute("aria-describedby", "email-description email-error")
})

test("login con contraseña incorrecta muestra el error de formulario", async ({ page }) => {
  await login(page, "nadie@example.com", "incorrecta-123")
  await expect(page.locator("[data-slot=alert][role=alert]")).toContainText("Correo o contraseña incorrectos")
})

test("login: tras 5 intentos fallidos, rate-limit", async ({ page }) => {
  const email = uniqueEmail("fuerza-bruta")
  await page.goto("/login")
  await page.getByLabel("Correo electrónico").fill(email)
  for (let i = 0; i < 6; i++) {
    await page.getByLabel("Contraseña", { exact: true }).fill(`incorrecta-${i}`)
    await page.getByRole("button", { name: "Entrar", exact: true }).click()
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled()
  }
  await expect(page.locator("[data-slot=alert][role=alert]")).toContainText("Demasiados intentos")
})

test("magic link: pide el enlace, lo abre y entra (cuenta nueva → onboarding)", async ({ page }) => {
  const email = uniqueEmail("magic")
  await page.goto("/login")
  await page.getByRole("button", { name: "Entrar con un enlace por correo" }).click()
  await page.getByLabel("Correo electrónico").fill(email)
  await page.getByRole("button", { name: "Enviarme un enlace" }).click()
  await expect(page.getByRole("status").filter({ hasText: "te llegará un enlace" })).toBeVisible()
  await page.goto(await linkFor(email, /Tu enlace para entrar/))
  await expect(page).toHaveURL(/\/onboarding/)
})

test("olvidé mi contraseña responde lo mismo exista o no el correo", async ({ page }) => {
  const { member } = users()
  const answer = async (email: string) => {
    await page.goto("/forgot-password")
    await page.getByLabel("Correo electrónico").fill(email)
    await page.getByRole("button", { name: "Enviar enlace" }).click()
    const status = page.getByRole("status")
    await expect(status).toBeVisible()
    return status.innerText()
  }
  const existing = await answer(member.email)
  const missing = await answer(uniqueEmail("no-existe"))
  expect(existing).toBe(missing)
  expect(existing).toContain("Si existe una cuenta")
})

test("rutas privadas sin sesión → /login?next= y vuelve después de entrar", async ({ page }) => {
  const { member } = users()
  await page.goto("/settings/security")
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings%2Fsecurity/)
  await page.getByLabel("Correo electrónico").fill(member.email)
  await page.getByLabel("Contraseña", { exact: true }).fill(member.password)
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await expect(page).toHaveURL(/\/settings\/security$/)
})

test("verify-email: reenviar respeta el cooldown y avisa con toast", async ({ page }) => {
  const email = uniqueEmail("reenvio")
  await page.goto("/verify-email")
  await page.getByLabel("Correo electrónico").fill(email)
  const before = mailCount(email, /Confirma tu correo/)
  await page.getByRole("button", { name: "Reenviar el correo" }).click()
  // Unknown email: same toast (no account enumeration), and the cooldown starts.
  await expectToast(page, "Te enviamos un enlace nuevo.")
  await expect(page.getByRole("button", { name: /Podrás reenviar en \d+ s/ })).toBeDisabled()
  expect(mailCount(email, /Confirma tu correo/)).toBe(before)
})
