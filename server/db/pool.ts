import { Pool as NeonPool } from "@neondatabase/serverless"
import { Kysely, PostgresDialect, type PostgresPool } from "kysely"
import pg from "pg"

import { databaseUrl, driverKind } from "./driver"
import type { Database } from "./schema"

/**
 * The transactional pool: Neon's WebSocket `Pool` in production, node-postgres
 * locally (see driver.ts). One per process — kept on globalThis so Next's dev
 * reloads don't leak a pool per edit.
 *
 * Node 22+ ships a global WebSocket, which is what the Neon Pool uses; no `ws`
 * package needed.
 */
const g = globalThis as unknown as { __allflowPool?: PostgresPool; __allflowKysely?: Kysely<Database> }

export function getPool(): PostgresPool {
  if (!g.__allflowPool) {
    const connectionString = databaseUrl()
    g.__allflowPool =
      driverKind(connectionString) === "pg"
        ? new pg.Pool({ connectionString, max: 5 })
        : (new NeonPool({ connectionString, max: 5 }) as unknown as PostgresPool)
  }
  return g.__allflowPool
}

/**
 * The dialect is lazy on purpose: `next build` imports the auth module to
 * collect route data, and DATABASE_URL may not exist at build time. The pool
 * is only created when Kysely opens its first connection.
 */
export function createDialect(): PostgresDialect {
  return new PostgresDialect({ pool: async () => getPool() })
}

/** Typed Kysely over the same pool — for the auth hooks, the seed and migrations. */
export function getKysely(): Kysely<Database> {
  g.__allflowKysely ??= new Kysely<Database>({ dialect: createDialect() })
  return g.__allflowKysely
}
