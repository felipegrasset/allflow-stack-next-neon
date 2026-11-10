<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Read CONVENTIONS.md first

`CONVENTIONS.md` has the rules of this app: read-only zones (`components/ui/**`,
`server/auth/**`), the form pattern, Tailwind v4 gotchas, dark mode, brand
colour, the Neon driver and `pnpm db:migrate`. They override your defaults.

# Módulos

Una funcionalidad nueva reutilizable va en `modules/<id>/` (contrato en
`modules/README.md`, ejemplo en `modules/_examples/ping/`), no en las anclas:
nunca edites `server/db/migrate.ts`, `server/db/schema/index.ts`,
`server/db/seed.ts`, `config/nav.ts` ni `lib/permissions.ts`. Corre
`pnpm modules:sync` después de agregar o quitar un módulo.
