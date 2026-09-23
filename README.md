# allflow-stack-next-neon

Stack template de AllFlow: Next.js 16 + Tailwind v4 + shadcn/ui (Base UI) +
Better Auth (email + contraseña, magic link, organizaciones con roles) sobre
Neon Postgres. Es el cascarón que el generador de AllFlow convierte en la app de
un cliente. **Las reglas para trabajar en él están en [`CONVENTIONS.md`](./CONVENTIONS.md).**

## Arrancar en local

Necesitas Node 22+, pnpm y un Postgres (local o Neon).

```bash
pnpm install
cp .env.example .env.local      # completa DATABASE_URL y BETTER_AUTH_SECRET;
                                # BETTER_AUTH_URL=http://localhost:3000
pnpm db:migrate                 # esquema + seed
pnpm dev
```

Sin `RESEND_API_KEY`, los correos (verificación, magic link, reset) se imprimen
en la consola del servidor: copia el enlace de ahí. El primer usuario que se
registra queda como `admin`.

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm tsc --noEmit` · `pnpm lint` | Tipos y lint |
| `pnpm db:migrate` | Migraciones Kysely + verificación contra Better Auth + seed |
| `pnpm db:seed` | Sólo el seed (idempotente) |
| `pnpm test:sentinels` | Contrato de centinelas con Forge (`allflow.sentinels.json`) |
| `pnpm test:e2e` | Playwright contra el build de producción: axe claro/oscuro + flujo de auth |

`pnpm test:e2e` necesita `pnpm build` antes, un Postgres migrado en
`DATABASE_URL` y Chromium (`pnpm exec playwright install chromium`).
