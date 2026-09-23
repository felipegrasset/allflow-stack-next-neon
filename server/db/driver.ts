/**
 * Which Postgres driver to use — the ONE place that decides it.
 *
 * Production talks to Neon, which has two drivers in @neondatabase/serverless:
 *   - HTTP (`neon()`): one HTTP request per query, no interactive
 *     transactions. The rest of the app uses it (lib/db.ts).
 *   - WebSocket `Pool`: a real pg-compatible pool with interactive
 *     transactions. Better Auth uses it, with `transaction: true`
 *     (server/auth/index.ts). See CONVENTIONS.md §"El driver de Neon".
 *
 * Neither speaks plain Postgres: the HTTP endpoint (`/sql`) and the WebSocket
 * proxy (`/v2`) only exist on Neon. So local dev and CI (a `postgres:16`
 * service) use node-postgres (`pg`) for BOTH roles instead. The switch:
 *
 *   DATABASE_DRIVER=pg    → node-postgres, always
 *   DATABASE_DRIVER=neon  → Neon drivers, always
 *   (unset)               → node-postgres when DATABASE_URL's host is
 *                           localhost / 127.0.0.1 / ::1, Neon otherwise
 */

export type DriverKind = "pg" | "neon"

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL no está definida. Copia .env.example a .env.local.")
  }
  return url
}

export function driverKind(url = process.env.DATABASE_URL): DriverKind {
  const forced = process.env.DATABASE_DRIVER
  if (forced === "pg" || forced === "neon") return forced
  if (forced) throw new Error(`DATABASE_DRIVER="${forced}" no es válido: usa "pg" o "neon".`)
  if (!url) return "neon"
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname) ? "pg" : "neon"
  } catch {
    return "neon"
  }
}
