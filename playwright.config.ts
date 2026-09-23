import { defineConfig, devices } from "@playwright/test"
import { join } from "node:path"

/**
 * e2e against the PRODUCTION build (`pnpm build` first). Needs a migrated
 * database in DATABASE_URL (local Postgres or the CI `postgres:16` service).
 * Emails are captured in DEV_MAIL_OUTBOX, where the auth test reads links.
 */
const PORT = Number(process.env.PORT ?? 3000)
const BASE_URL = `http://localhost:${PORT}`
export const OUTBOX = join(import.meta.dirname, ".dev-outbox.e2e.jsonl")

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      BETTER_AUTH_URL: BASE_URL,
      DEV_MAIL_OUTBOX: OUTBOX,
      // Never send real email from tests.
      RESEND_API_KEY: "",
    },
  },
})
