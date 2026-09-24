/**
 * The seed — idempotent, run by `pnpm db:migrate` (and alone by `pnpm db:seed`).
 * Creates the default organization and its `admin` role, and promotes the
 * earliest registered user if nobody is admin yet (covers users that signed up
 * before the seed ever ran), and makes every other user without a membership
 * a `member` (T2). New sign-ups get both from the auth hook.
 */
import type { Kysely } from "kysely"

import { backfillMembers, ensureDefaultOrganization, promoteFirstAdmin } from "@/server/auth/bootstrap"
import type { Database } from "./schema"

export async function seed(db: Kysely<Database>): Promise<void> {
  const orgId = await ensureDefaultOrganization(db)
  console.log(`[db:seed] organización por defecto: ${orgId} (rol admin listo)`)
  const promoted = await promoteFirstAdmin(db)
  console.log(
    promoted
      ? "[db:seed] el primer usuario registrado ahora es admin"
      : "[db:seed] admin: ya existe, o todavía no hay usuarios (el primero en registrarse lo será)"
  )
  const added = await backfillMembers(db)
  if (added) console.log(`[db:seed] ${added} usuario(s) sin membresía quedaron como member`)
}

// `tsx server/db/seed.ts` runs it standalone.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { getKysely } = await import("./pool")
  const db = getKysely()
  seed(db)
    .catch((err) => {
      console.error("[db:seed] falló:", err)
      process.exitCode = 1
    })
    .finally(() => db.destroy())
}
