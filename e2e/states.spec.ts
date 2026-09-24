import { expect, test, type BrowserContext } from "@playwright/test"

import { E2E_FAULT_COOKIE, type E2EFault } from "../lib/e2e-faults"
import { STATE, users } from "./helpers"

/**
 * The screens that exist for when something goes wrong or is slow, which no
 * normal flow reaches: error.tsx, global-error.tsx, /admin/users empty and
 * failed, and the loading.tsx skeletons. They are reached through
 * server/e2e-faults.ts (E2E_FAULTS=1 on the webServer, a cookie per test) —
 * see CONVENTIONS.md §"Estados de error en el e2e".
 *
 * Every "retry" test removes the fault and then presses the button: the point
 * is that retry() re-fetches the segment, not just re-renders the error.
 */

const BASE = `http://localhost:${Number(process.env.PORT ?? 3000)}`

async function inject(context: BrowserContext, ...faults: E2EFault[]) {
  await context.addCookies([{ name: E2E_FAULT_COOKIE, value: faults.join(","), url: BASE }])
}

async function clear(context: BrowserContext) {
  await context.clearCookies({ name: E2E_FAULT_COOKIE })
}

test.describe("estados (admin)", () => {
  test.use({ storageState: STATE.admin })

  test("/admin/users sin más miembros → estado vacío con la invitación", async ({ page, context }) => {
    await inject(context, "admin-users-empty")
    await page.goto("/admin/users")
    const empty = page.getByTestId("users-empty")
    await expect(empty).toBeVisible()
    await expect(empty.getByRole("heading", { name: "Todavía estás solo" })).toBeVisible()
    await expect(page.getByTestId("member-row")).toHaveCount(1) // sólo "Tú"
  })

  test("/admin/users falla → su error.tsx, y Reintentar vuelve a pedir la lista", async ({ page, context }) => {
    await inject(context, "admin-users-error")
    await page.goto("/admin/users")
    await expect(page.getByRole("heading", { name: "No pudimos cargar los usuarios." })).toBeVisible()
    // The shell (header, nav) survives: the boundary is the segment's, not the root's.
    await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible()

    await clear(context)
    await page.getByRole("button", { name: "Reintentar" }).click()
    await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toBeVisible()
    await expect(page.locator(`[data-testid=member-row][data-email="${users().admin.email}"]`)).toBeVisible()
  })

  test("/admin/users lento → skeleton de tabla, después la tabla", async ({ page, context }) => {
    await inject(context, "slow")
    // "commit", not "load": the streamed HTML carries loading.tsx first and the
    // page 1.5 s later; waiting for load would skip straight past the skeleton.
    await page.goto("/admin/users", { waitUntil: "commit" })
    const skeleton = page.getByTestId("table-skeleton")
    await expect(skeleton).toBeVisible()
    await expect(skeleton.getByRole("status")).toBeAttached()
    await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toBeVisible()
    await expect(skeleton).toHaveCount(0)
  })
})

test.describe("estados (cualquier usuario)", () => {
  test.use({ storageState: STATE.member })

  test("una página que falla → error.tsx, y Reintentar la vuelve a cargar", async ({ page, context }) => {
    await inject(context, "page-error")
    await page.goto("/settings/profile")
    await expect(page.getByRole("heading", { name: "Algo salió mal" })).toBeVisible()
    await expect(page.getByText(/Código del error:/)).toBeVisible()
    await expect(page.getByRole("link", { name: "Ir al inicio" })).toBeVisible()

    await clear(context)
    await page.getByRole("button", { name: "Reintentar" }).click()
    await expect(page.getByRole("heading", { level: 1, name: "Perfil" })).toBeVisible()
  })

  test("el layout raíz falla → global-error.tsx, con su propio documento", async ({ page, context }) => {
    await inject(context, "layout-error")
    await page.goto("/settings/profile")
    await expect(page.getByRole("heading", { name: "La aplicación tuvo un problema" })).toBeVisible()
    await expect(page).toHaveTitle(/La aplicación tuvo un problema/)
    await expect(page.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/")

    await clear(context)
    await page.getByRole("button", { name: "Reintentar" }).click()
    await expect(page.getByRole("heading", { level: 1, name: "Perfil" })).toBeVisible()
  })

  test("/settings/profile lento → skeleton del perfil, después el formulario", async ({ page, context }) => {
    await inject(context, "slow")
    await page.goto("/settings/profile", { waitUntil: "commit" })
    await expect(page.getByTestId("form-skeleton")).toBeVisible()
    await expect(page.getByRole("heading", { level: 1, name: "Perfil" })).toBeVisible()
    await expect(page.getByTestId("form-skeleton")).toHaveCount(0)
  })
})
