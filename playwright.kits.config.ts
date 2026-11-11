import { defineConfig, devices } from "@playwright/test"

/**
 * Solo las vistas previas de los kits (e2e/kits.spec.ts): sin base de datos ni
 * sesiones, porque las rutas `/kits/*` son públicas. `pnpm build` primero.
 */
const PORT = Number(process.env.PORT ?? 3100)
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./e2e",
  testMatch: /kits(-interacciones)?\.spec\.ts/,
  fullyParallel: true,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: BASE_URL, locale: "es-CL" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: `${BASE_URL}/kits/core`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { BETTER_AUTH_URL: BASE_URL, RESEND_API_KEY: "" },
  },
})
