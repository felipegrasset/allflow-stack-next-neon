/**
 * `pnpm db:migrate` — the ONLY way the schema reaches a database.
 *
 *   1. Applies pending Kysely migrations (server/db/migrations, in order,
 *      tracked in `kysely_migration`). Over the transactional pool, so a
 *      migration that fails half-way is rolled back (Postgres has
 *      transactional DDL; the Neon HTTP driver does not — never migrate over it).
 *   2. Asks Better Auth (`getMigrations`) whether the live schema covers the
 *      auth config. If a Better Auth upgrade or a new plugin needs a column,
 *      this fails and prints the SQL it would run — write it as a new
 *      migration file, don't let the CLI mutate the schema behind our back.
 *   3. Runs the seed (idempotent): the default organization, its `admin` role,
 *      and promotes the first registered user if nobody is admin yet.
 *
 * Usage: pnpm db:migrate            (up to latest)
 *        pnpm db:migrate --down     (revert the last migration; local only)
 */
import { Migrator, type Migration, type MigrationProvider } from "kysely/migration"
import { getMigrations } from "better-auth/db/migration"

import { authOptions } from "@/server/auth/options"
import { getKysely } from "./pool"
import { driverKind } from "./driver"
import { seed } from "./seed"
import * as m0001 from "./migrations/0001_auth"
import * as m0002 from "./migrations/0002_rate_limit"

/** Explicit list, not a directory scan: works the same under tsx, bundlers and CI. */
const MIGRATIONS: Record<string, Migration> = {
  "0001_auth": m0001,
  "0002_rate_limit": m0002,
}

const provider: MigrationProvider = { getMigrations: async () => MIGRATIONS }

async function main() {
  const down = process.argv.includes("--down")
  const db = getKysely()
  console.log(`[db:migrate] driver: ${driverKind()}`)

  const migrator = new Migrator({ db, provider })
  const { error, results } = down ? await migrator.migrateDown() : await migrator.migrateToLatest()
  for (const r of results ?? []) {
    console.log(`[db:migrate] ${r.direction} ${r.migrationName}: ${r.status}`)
  }
  if (error) throw error
  if (!results?.length) console.log("[db:migrate] nada pendiente")
  if (down) return

  const plan = await getMigrations(authOptions, { throwOnUnsafe: false })
  const drift = [
    ...plan.toBeCreated.map((t) => `crear tabla ${t.table}`),
    ...plan.toBeAdded.map((t) => `agregar a ${t.table}: ${Object.keys(t.fields).join(", ")}`),
    ...plan.toBeAddedIndexes.map((i) => `índice ${i.name} en ${i.table}`),
    ...plan.unsafeChanges,
    ...plan.schemaProblems,
  ]
  if (drift.length) {
    console.error("[db:migrate] El esquema no cubre la config de Better Auth:")
    for (const d of drift) console.error(`  - ${d}`)
    console.error("\nSQL que propone Better Auth (escríbelo como migración nueva):\n")
    console.error(await plan.compileMigrations())
    process.exitCode = 1
    return
  }
  console.log("[db:migrate] esquema alineado con Better Auth")

  await seed(db)
}

main()
  .catch((err) => {
    console.error("[db:migrate] falló:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    // Ends the shared pool too (PostgresDialect's driver calls pool.end()).
    await getKysely().destroy().catch(() => {})
  })
