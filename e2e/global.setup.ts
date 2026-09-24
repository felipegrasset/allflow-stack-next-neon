import { mkdirSync, writeFileSync } from "node:fs"
import { expect, test as setup } from "@playwright/test"

import { AUTH_DIR, STATE, USERS_FILE, signUp, skipOnboarding, uniqueEmail, verify, withDb, type E2EUsers } from "./helpers"

/**
 * Creates the e2e's users once, through the real UI, and saves their sessions:
 *  - admin:   the FIRST user to register → admin of the app's organization
 *             (on a fresh database, as in CI, that is asserted; on a reused
 *             local database someone registered first, so it is promoted by SQL);
 *  - member:  a regular user (gets the 403 on /admin/users);
 *  - target:  a regular user the admin test changes roles on;
 *  - pending: verified but NOT onboarded (for /onboarding's a11y).
 */
setup("usuarios del e2e", async ({ browser }) => {
  mkdirSync(AUTH_DIR, { recursive: true })
  const password = "una-clave-larga-123"
  // Unique names too: a reused local database keeps the users of earlier runs.
  const run = Date.now().toString(36).slice(-5)
  const all: E2EUsers = {
    admin: { name: `Ada Admin ${run}`, email: uniqueEmail("admin"), password },
    member: { name: `Mario Miembro ${run}`, email: uniqueEmail("member"), password },
    target: { name: `Tomás Objetivo ${run}`, email: uniqueEmail("target"), password },
    pending: { name: `Paula Pendiente ${run}`, email: uniqueEmail("pending"), password },
  }
  const freshDb = await withDb(async (db) => (await db.query(`select count(*)::int as n from "user"`)).rows[0].n === 0)

  for (const key of ["admin", "member", "target", "pending"] as const) {
    const u = all[key]
    const context = await browser.newContext()
    const page = await context.newPage()
    await signUp(page, u)
    await verify(page, u.email)
    if (key !== "pending") await skipOnboarding(page)
    if (key === "admin" && !freshDb) {
      await withDb((db) =>
        db.query(`update member set role = 'admin' where "userId" = (select id from "user" where email = $1)`, [u.email])
      )
    }
    if (key === "admin" || key === "member" || key === "pending") {
      await context.storageState({ path: STATE[key] })
    }
    await context.close()
  }

  const roles = await withDb(async (db) =>
    Object.fromEntries(
      (
        await db.query(
          `select u.email, m.role from "user" u join member m on m."userId" = u.id where u.email = any($1)`,
          [Object.values(all).map((u) => u.email)]
        )
      ).rows.map((r: { email: string; role: string }) => [r.email, r.role])
    )
  )
  expect(roles[all.admin.email]).toBe("admin")
  expect(roles[all.member.email]).toBe("member")
  expect(roles[all.target.email]).toBe("member")
  if (freshDb) console.log("[e2e] base nueva: el primer usuario quedó admin solo")

  writeFileSync(USERS_FILE, JSON.stringify(all, null, 2))
})
