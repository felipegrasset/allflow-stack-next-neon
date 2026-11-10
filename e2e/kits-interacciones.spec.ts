import { expect, test } from "@playwright/test"

/** Lo que se mueve en los kits de cobro: el selector de período y el cupón. Sin sesión ni base de datos. */
test("precios-checkout: el selector cambia el precio mensual", async ({
  page,
}) => {
  await page.goto("/kits/precios-checkout")
  const pro = page
    .getByRole("listitem")
    .filter({ hasText: "Para trabajar a diario" })
  await expect(pro).toContainText("US$15,83") // anual: 190 / 12
  await page.getByRole("button", { name: "Mensual" }).click()
  await expect(pro).toContainText("US$19,00")
})

test("precios-checkout: el cupón válido rebaja el total y el inválido avisa", async ({
  page,
}) => {
  await page.goto("/kits/precios-checkout")
  await expect(page.getByText("US$226,10")).toBeVisible()
  await page.getByLabel("Código de descuento").fill("NOEXISTE")
  await page.getByRole("button", { name: "Aplicar" }).click()
  await expect(
    page.getByRole("alert").filter({ hasText: "no es válido" })
  ).toBeVisible()
  await expect(page.getByText("US$226,10")).toBeVisible()
  await page.getByLabel("Código de descuento").fill("bienvenida")
  await page.getByRole("button", { name: "Aplicar" }).click()
  await expect(
    page.getByText("Código aplicado: 15 % de descuento.")
  ).toBeVisible()
  await expect(
    page.getByText("US$192,19").or(page.getByText("US$192,18"))
  ).toBeVisible()
})

test("producto-suscripcion: el selector anual/mensual cambia los planes", async ({
  page,
}) => {
  await page.goto("/kits/producto-suscripcion")
  const pro = page.getByRole("listitem").filter({ hasText: "Más elegido" })
  await expect(pro).toContainText("US$7")
  await page.getByRole("button", { name: "Mensual" }).click()
  await expect(pro).toContainText("US$9")
})
