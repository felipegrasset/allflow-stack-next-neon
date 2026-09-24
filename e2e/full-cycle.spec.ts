import { expect, test } from "@playwright/test"

import { expectToast, linkFor, login, logout, signUp, uniqueEmail, verify } from "./helpers"

/** 1×1 PNG, red. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64"
)

/**
 * The whole floor, one user, end to end:
 * sign-up → verify (link from the dev outbox) → onboarding → profile →
 * avatar → change password → logout → forgot/reset → login with the new one.
 */
test("ciclo completo del piso mínimo", async ({ page }) => {
  test.setTimeout(120_000)
  const email = uniqueEmail("full")
  const password = "clave-original-123"
  const newPassword = "clave-cambiada-456"
  const resetPassword = "clave-restablecida-789"

  // ── Registro + verificación ──────────────────────────────────────────────
  await signUp(page, { name: "Flor Completa", email, password })
  await verify(page, email)
  await page.getByRole("link", { name: "Continuar" }).click()

  // ── Onboarding: progreso, validación, persistencia al volver ─────────────
  await expect(page).toHaveURL(/\/onboarding/)
  await expect(page.getByText("Paso 1 de 3")).toBeVisible()
  const name = page.getByLabel("Nombre")
  await expect(name).toHaveValue("Flor Completa")
  await name.fill("")
  await page.getByRole("button", { name: "Siguiente" }).click()
  await expect(page.getByText("El nombre es obligatorio")).toBeVisible()
  await name.fill("Flor Onboarding")
  await page.getByRole("button", { name: "Siguiente" }).click()
  await expect(page.getByText("Paso 2 de 3")).toBeVisible()
  await expect(page.getByTestId("onboarding-step-title")).toBeFocused()
  await page.getByRole("button", { name: "Atrás" }).click()
  await expect(page.getByLabel("Nombre")).toHaveValue("Flor Onboarding") // persisted
  await page.getByRole("button", { name: "Siguiente" }).click()
  await page.getByLabel("Idioma").selectOption("en")
  await page.getByRole("button", { name: "Siguiente" }).click()
  await expect(page.getByText("Paso 3 de 3")).toBeVisible()
  await expect(page.getByText("English")).toBeVisible()
  await page.getByRole("button", { name: "Terminar" }).click()
  await expect(page.getByTestId("session-email")).toContainText(email)
  await expect(page.getByRole("heading", { name: "Hola, Flor Onboarding" })).toBeVisible()

  // Onboarded: /onboarding no longer applies.
  await page.goto("/onboarding")
  await expect(page).toHaveURL(/\/$/)

  // ── Perfil: estado sucio, guardar, toast ─────────────────────────────────
  await page.goto("/settings/profile")
  await expect(page.getByLabel("Idioma")).toHaveValue("en")
  await page.getByLabel("Nombre").fill("Flor Perfil")
  await expect(page.getByTestId("dirty-hint")).toBeVisible()
  await page.getByRole("link", { name: "Seguridad" }).click()
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toContainText("Tienes cambios sin guardar")
  await dialog.getByRole("button", { name: "Seguir editando" }).click()
  await expect(page).toHaveURL(/\/settings\/profile$/)
  await page.getByRole("button", { name: "Guardar cambios" }).click()
  await expectToast(page, "Perfil actualizado")
  await expect(page.getByTestId("dirty-hint")).toHaveCount(0)
  await expect(page.locator("header")).toContainText("Flor Perfil")

  // ── Avatar: iniciales, validación antes de subir, preview, quitar ────────
  const preview = page.getByTestId("avatar-preview")
  await expect(preview).toHaveAttribute("data-has-image", "false")
  await expect(preview).toContainText("FP")
  await page.getByTestId("avatar-input").setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("hola") })
  await expect(page.locator("[data-slot=alert][role=alert]")).toContainText("no es una imagen")
  await expect(preview).toHaveAttribute("data-has-image", "false")
  await page.getByTestId("avatar-input").setInputFiles({ name: "yo.png", mimeType: "image/png", buffer: PNG })
  await expect(preview).toHaveAttribute("data-has-image", "true")
  await expectToast(page, "Foto actualizada")
  await page.reload()
  await expect(page.getByTestId("avatar-preview").locator("img")).toHaveAttribute("src", /^data:image\/(webp|jpeg);base64,/)
  await page.getByRole("button", { name: "Quitar foto" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Quitar foto" }).click()
  await expectToast(page, "Foto eliminada")
  await expect(page.getByTestId("avatar-preview")).toHaveAttribute("data-has-image", "false")

  // ── Seguridad: contraseña actual incorrecta, luego el cambio ─────────────
  await page.goto("/settings/security")
  await page.getByLabel("Contraseña actual").fill("no-es-esta-123")
  await page.getByLabel("Contraseña nueva", { exact: true }).fill(newPassword)
  await page.getByLabel("Repite la contraseña nueva").fill(newPassword)
  await page.getByRole("button", { name: "Cambiar contraseña" }).click()
  await expect(page.getByText("La contraseña actual no es correcta.")).toBeVisible()
  await expect(page.getByLabel("Contraseña actual")).toBeFocused()
  await page.getByLabel("Contraseña actual").fill(password)
  await page.getByRole("button", { name: "Cambiar contraseña" }).click()
  await expectToast(page, /Contraseña cambiada/)
  await expect(page.getByTestId("sessions-count")).toContainText("Sólo tienes esta sesión")

  // ── Logout; la contraseña vieja ya no sirve ──────────────────────────────
  await logout(page)
  await login(page, email, password)
  await expect(page.locator("[data-slot=alert][role=alert]")).toContainText("Correo o contraseña incorrectos")

  // ── Olvidé mi contraseña → enlace → nueva contraseña ─────────────────────
  await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click()
  await expect(page.getByRole("heading", { name: "¿Olvidaste tu contraseña?" })).toBeVisible()
  await page.getByLabel("Correo electrónico").fill(email)
  await page.getByRole("button", { name: "Enviar enlace" }).click()
  await expect(page.getByRole("status")).toContainText("Si existe una cuenta")
  const resetLink = await linkFor(email, /Restablece tu contraseña/)
  expect(resetLink).toMatch(/\/reset-password\/[^/?]+$/)
  await page.goto(resetLink)
  await page.getByRole("textbox", { name: "Contraseña nueva" }).fill(resetPassword)
  await page.getByRole("textbox", { name: "Repite la contraseña" }).fill("otra-cosa-000")
  await page.getByRole("button", { name: "Guardar contraseña" }).click()
  await expect(page.getByText("Las contraseñas no coinciden")).toBeVisible()
  await page.getByRole("textbox", { name: "Repite la contraseña" }).fill(resetPassword)
  await page.getByRole("button", { name: "Guardar contraseña" }).click()
  await expect(page).toHaveURL(/\/login\?reset=ok/)
  await expect(page.getByRole("status").filter({ hasText: "Contraseña actualizada" })).toBeVisible()

  // The link is single-use.
  await page.goto(resetLink)
  await expect(page.getByRole("heading", { name: /no es válido o venció/ })).toBeVisible()

  // ── Login con la contraseña nueva ────────────────────────────────────────
  await login(page, email, resetPassword)
  await expect(page.getByTestId("session-email")).toContainText(email)
})
