import { expect, test } from "@playwright/test"

import { STATE, expectToast, users } from "./helpers"

test.describe("admin de usuarios (admin)", () => {
  test.use({ storageState: STATE.admin })

  test("ve la tabla, promueve y degrada (con confirmación) a un usuario", async ({ page }) => {
    const { admin, target } = users()
    await page.goto("/admin/users")
    await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toBeVisible()
    await expect(page.locator(`[data-testid=member-row][data-email="${admin.email}"]`)).toContainText("Tú")

    const row = page.locator(`[data-testid=member-row][data-email="${target.email}"]`)
    const select = row.getByRole("combobox", { name: `Rol de ${target.name}` })
    await expect(select).toHaveValue("member")

    // Promote: no confirmation needed, toast.
    await select.selectOption("admin")
    await expectToast(page, `${target.name} ahora es administrador`)
    await expect(select).toHaveValue("admin")

    // Demote: AlertDialog first. Cancel keeps the role…
    await select.selectOption("member")
    const dialog = page.getByRole("alertdialog")
    await expect(dialog).toContainText(`¿Quitarle el rol de administrador a ${target.name}?`)
    await dialog.getByRole("button", { name: "Cancelar" }).click()
    await expect(select).toHaveValue("admin")

    // …confirming applies it.
    await select.selectOption("member")
    await page.getByRole("alertdialog").getByRole("button", { name: "Quitar rol de administrador" }).click()
    await expectToast(page, `${target.name} ahora es miembro`)
    await expect(select).toHaveValue("member")
  })

  test("quitar a un usuario pide confirmación (y cancelar no hace nada)", async ({ page }) => {
    const { target } = users()
    await page.goto("/admin/users")
    await page.getByRole("button", { name: `Quitar a ${target.name}` }).click()
    const dialog = page.getByRole("alertdialog")
    await expect(dialog).toContainText(`¿Quitar a ${target.name} de la app?`)
    await dialog.getByRole("button", { name: "Cancelar" }).click()
    await expect(page.locator(`[data-testid=member-row][data-email="${target.email}"]`)).toBeVisible()
  })

  test("el menú muestra 'Usuarios' al admin", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Usuarios" })).toBeVisible()
  })
})

test.describe("admin de usuarios (no admin)", () => {
  test.use({ storageState: STATE.member })

  test("un usuario sin rol admin recibe 403, no 404", async ({ page }) => {
    const res = await page.goto("/admin/users")
    expect(res?.status()).toBe(403)
    await expect(page.getByRole("heading", { name: "No tienes acceso a esta sección" })).toBeVisible()
    await page.goto("/")
    await expect(page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Usuarios" })).toHaveCount(0)
  })
})
