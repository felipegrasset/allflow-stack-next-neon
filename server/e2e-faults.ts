import { cookies } from "next/headers"

import { E2E_FAULT_COOKIE, type E2EFault } from "@/lib/e2e-faults"

/**
 * Fault injection for the e2e — the only way to reach the screens that exist
 * for things going wrong: error.tsx, global-error.tsx, the empty and failed
 * states of /admin/users, and the loading.tsx skeletons. See CONVENTIONS.md
 * §"Estados de error en el e2e".
 *
 * OFF unless `E2E_FAULTS=1` in the SERVER's environment (playwright.config.ts
 * sets it on the webServer), and never on Vercel even if someone sets it
 * there. When off, `fault()` returns false without reading any cookie, so it
 * costs nothing and does not make a page dynamic.
 *
 * When on, a test picks the faults with a cookie (comma-separated names):
 *
 *   await context.addCookies([{ name: E2E_FAULT_COOKIE, value: "admin-users-error", url }])
 *
 * The e2e build is the production build (`pnpm build && pnpm start`), which
 * is why this is an env flag read at request time and not a NODE_ENV=test
 * route: NODE_ENV is "production" there.
 */

export { E2E_FAULT_COOKIE, type E2EFault } from "@/lib/e2e-faults"

export function faultsEnabled(): boolean {
  return process.env.E2E_FAULTS === "1" && !process.env.VERCEL
}

/** Is `name` active for this request? */
export async function fault(name: E2EFault): Promise<boolean> {
  if (!faultsEnabled()) return false
  const raw = (await cookies()).get(E2E_FAULT_COOKIE)?.value ?? ""
  return raw.split(",").map((s) => s.trim()).includes(name)
}

/** Throw if `name` is active — the message says it was injected, so no one chases it. */
export async function throwIfFault(name: E2EFault): Promise<void> {
  if (await fault(name)) throw new Error(`Falla inyectada por el e2e: ${name}`)
}

/** Wait if the `slow` fault is active, so the segment's loading.tsx shows. */
export async function slowIfFault(ms = 1500): Promise<void> {
  if (await fault("slow")) await new Promise((r) => setTimeout(r, ms))
}
