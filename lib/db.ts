import { neon } from "@neondatabase/serverless"
import pg from "pg"

import { databaseUrl, driverKind } from "@/server/db/driver"

/**
 * `sql` — the app's database access (server only).
 *
 *   const rows = await sql<{ id: string }>`select id from "user" where email = ${email}`
 *
 * In production it is Neon's HTTP driver: one HTTPS request per query, no
 * connection to manage, the right default for serverless. It does NOT support
 * interactive transactions — if you need BEGIN/COMMIT, use the transactional
 * pool (`getKysely()` from server/db/pool.ts), never `transaction: true` here.
 *
 * Locally (DATABASE_URL on localhost, or DATABASE_DRIVER=pg) the same tagged
 * template runs on node-postgres, because the Neon HTTP endpoint only exists
 * on Neon. Values are always bound as parameters, never interpolated.
 */
export type Sql = <T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<T[]>

let impl: Sql | undefined

function create(): Sql {
  const url = databaseUrl()
  if (driverKind(url) === "neon") {
    const query = neon(url)
    return <T,>(strings: TemplateStringsArray, ...values: unknown[]) =>
      query(strings, ...values) as Promise<T[]>
  }
  const pool = new pg.Pool({ connectionString: url, max: 5 })
  return async <T,>(strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.reduce((acc, s, i) => acc + (i === 0 ? "" : `$${i}`) + s, "")
    const res = await pool.query(text, values)
    return res.rows as T[]
  }
}

export const sql: Sql = (strings, ...values) => {
  impl ??= create()
  return impl(strings, ...values)
}
