# CONVENTIONS.md — lo que todo agente lee antes de tocar esta app

Esta app nació del template `allflow-stack-next-neon` de AllFlow. Las reglas de
acá no son de estilo: cada una evita un error que un agente comete solo y no
diagnostica. Si una regla choca con lo que te pidieron, **pregunta antes de
romperla**.

Stack: Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind v4 ·
shadcn/ui sobre Base UI (`@base-ui/react`) · Better Auth · Neon Postgres ·
Zod 4 · React Hook Form. Gestor de paquetes: **pnpm** (nunca npm ni yarn).

---

## 1 · Zonas de no-edición

| Ruta | Qué es | Cómo se cambia |
|---|---|---|
| `components/ui/**` | Componentes de shadcn | **Se compone encima, nunca se edita.** Si necesitas otra variante, crea un componente en `components/` que envuelva al de `ui/`. Para traer uno nuevo: `pnpm dlx shadcn@latest add <nombre>` |
| `server/auth/**` | Configuración de Better Auth, alta del primer admin | **Se extiende, no se modifica.** Permisos nuevos van en `lib/permissions.ts`; textos de correo en `server/email/templates.ts`; lógica propia de la app, en hooks o módulos fuera de esta carpeta |

Por qué: AllFlow actualiza estas dos carpetas desde el template (una rama
`allflow/baseline` que se mergea sobre `main`). Si las editas, cada
actualización es un conflicto. `CODEOWNERS` exige revisión de AllFlow en ambas.

## 2 · Formularios

- Familia **`Field`** de shadcn (`Field`, `FieldLabel`, `FieldDescription`,
  `FieldError`, `FieldGroup`…) + **`Controller`** de React Hook Form.
- **No** uses el viejo `<Form>` / `<FormField render={…}>`: ya no existe en
  shadcn y genera código obsoleto.
- **Un solo esquema Zod** (en `lib/schemas/`) para el cliente
  (`zodResolver`, `mode: "onBlur"`) **y** para la Server Action, que lo vuelve a
  validar con `safeParse` — las Server Actions son alcanzables por POST directo.
- Errores del servidor vuelven como valor de retorno y se montan con `setError`.

Las cinco reglas de accesibilidad, en cada campo:

1. `aria-invalid` en el **control**, `data-invalid` en el **wrapper** `Field`.
2. `aria-describedby` apunta a la descripción **y** al error a la vez,
   separados por espacio.
3. El error del formulario completo lleva `role="alert"`.
4. `setError(campo, …, { shouldFocus: true })` para errores de servidor.
5. `disabled` + `aria-busy` en el botón mientras envía.

Ejemplo vivo: `app/(auth)/signup/signup-form.tsx` + `app/(auth)/actions.ts`.

## 3 · Tailwind v4 — tres cosas que se rompen siempre

1. `:root` y `.dark` van **fuera** de `@layer base`. Dentro, la especificidad
   los anula.
2. `@theme` **lleva** `inline` (`@theme inline { … }`). Sin él, Tailwind no
   resuelve los `var()` en build.
3. **No existe** `darkMode: 'class'` ni `tailwind.config.js`. El modo oscuro es
   `@custom-variant dark (&:is(.dark *));` en `app/globals.css`.

## 4 · Modo oscuro con código propio (sin `next-themes`)

Decisión D9 (23/09/2026). `components/theme-provider.tsx` tiene:

- `<ThemeScript />`, que `app/layout.tsx` pone en `<head>`: un script de seis
  líneas que pone la clase `dark` en `<html>` **antes del primer pintado**
  (lee `localStorage.theme`, o `prefers-color-scheme` si no hay preferencia).
- `useTheme()`, un hook con `useSyncExternalStore` sobre el DOM y
  `localStorage` (no sobre estado de React). `setTheme("light" | "dark" | "system")`.

**No instales `next-themes`**: lleva 18 meses sin release y su issue #375
reescribe el tema con un valor viejo cuando la app activa `cacheComponents`.
Con este código esa trampa no existe, pero el template igual nace con
`cacheComponents` apagado (el default de Next 16.3).

Reglas: nunca pongas `className="dark"` fijo en `<html>`; `suppressHydrationWarning`
en `<html>` es obligatorio (el script lo muta antes de hidratar); un componente
que muestre el tema actual debe tolerar `resolvedTheme === null` en el primer
render (ver `components/theme-toggle.tsx`).

## 5 · Color de marca

Se cambia **`--brand-h`** (matiz OKLCH, 0–360) y **`--brand-c`** (croma, 0–0.4)
en el primer bloque de `app/globals.css`, **y nada más**. Los tokens semánticos
(`--primary`, `--ring`, `--accent`, `--muted`…) se derivan de esos dos en claro
y en oscuro, y mantienen el contraste.

Nunca elijas un color de texto a mano: usa los pares `bg-primary
text-primary-foreground`, `bg-muted text-muted-foreground`, etc. El test
`e2e/a11y.spec.ts` (axe, WCAG 2.2 AA, claro y oscuro) falla si el contraste se
rompe.

## 6 · Base de datos: el driver de Neon

**Better Auth y el driver HTTP de Neon.** El driver HTTP (`neon()` /
`kysely-neon` / `drizzle-orm/neon-http`) no soporta transacciones interactivas.
Better Auth corre sin transacciones si el adapter no las declara, así que
**funciona**, pero sin rollback: si el alta falla a la mitad queda un `user` sin
`account` y ese correo ya no puede registrarse (sólo recupera por "olvidé mi
contraseña"). Por eso `server/auth/options.ts` usa un `Pool` (WebSocket) con
`database: { dialect: new PostgresDialect({ pool }), type: "postgres",
transaction: true }`, y el resto de la app usa HTTP. **Nunca** pongas
`transaction: true` sobre el driver HTTP: el alta tira `No transactions support
in neon-http driver` (Drizzle) o `NeonDialect doesn't support interactive
transactions` (Kysely). Y declara `transaction` siempre: la auto-detección
cambió entre Better Auth 1.6 y 1.7. La tabla se llama `"user"`: en SQL a mano,
con comillas.

Cómo está armado en este repo:

| Qué | Producción (Neon) | Local y CI (Postgres normal) |
|---|---|---|
| Consultas de la app: `sql` de `lib/db.ts` | driver HTTP `neon()` | `pg` (node-postgres) |
| Better Auth, seed y migraciones: `server/db/pool.ts` | `Pool` WebSocket de `@neondatabase/serverless` | `pg.Pool` |

El switch vive en **un solo lugar**, `server/db/driver.ts`:

- `DATABASE_DRIVER=pg` o `DATABASE_DRIVER=neon` lo fuerza.
- Sin definir: si el host de `DATABASE_URL` es `localhost`, `127.0.0.1` o
  `::1` → `pg`; cualquier otro → Neon.

Por qué hace falta: el endpoint HTTP (`/sql`) y el proxy WebSocket de Neon sólo
existen en Neon; contra un Postgres local ninguno de los dos drivers conecta.
El `Pool` de Neon habla el mismo protocolo que `pg`, así que Kysely y Better
Auth no notan la diferencia.

Reglas:

- Consultas de la app: `` sql`select … where id = ${id}` `` — los valores
  siempre como parámetros, nunca concatenados.
- ¿Necesitas `BEGIN`/`COMMIT`? Usa `getKysely().transaction()` (el pool), no
  el `sql` HTTP.
- No crees pools nuevos: `getPool()` es uno por proceso.

## 7 · Tabla `"user"`

Better Auth nombra la tabla `user`, palabra reservada en Postgres (decisión D3:
forma nativa). **En SQL a mano va siempre entre comillas**: `select * from
"user"`. Las columnas son camelCase y también van citadas: `"emailVerified"`,
`"createdAt"`, `"userId"`. Kysely y Better Auth ya citan solos.

## 8 · El esquema no se aplica solo: `pnpm db:migrate`

- `pnpm db:migrate` aplica las migraciones de `server/db/migrations/` (Kysely,
  en orden, registradas en `kysely_migration`), después **verifica** con Better
  Auth que el esquema cubre su configuración, y corre el seed (idempotente).
- Si el verificador falla (subiste Better Auth o agregaste un plugin), imprime
  el SQL que falta: escríbelo como **migración nueva** (`0002_….ts`) y súmala a
  la lista de `server/db/migrate.ts`. **No** uses `npx auth migrate`: cambia el
  esquema sin dejar registro.
- Nunca edites una migración ya aplicada en producción; agrega otra.
- El seed crea la organización de la app y su rol `admin` (en
  `"organizationRole"`), y el **primer usuario que se registra** queda como
  `admin` de esa organización.

## 9 · Auth

- En Server Components y Server Actions: `auth.api.getSession({ headers: await
  headers() })` (de `@/server/auth`). En el cliente: `authClient` de
  `lib/auth-client.ts`.
- El plugin `nextCookies()` va **último** en la lista de plugins: sin él, las
  Server Actions no pueden poner la cookie de sesión.
- Login con correo + contraseña (requiere verificar el correo) y magic link.
  Google OAuth no viene activado.
- Correo: con `RESEND_API_KEY` sale por Resend; sin ella se imprime en la
  consola del servidor (y en `DEV_MAIL_OUTBOX` si está definido).
- `pnpm build` necesita `BETTER_AUTH_SECRET` definida para no imprimir errores
  (compila igual); en producción es obligatoria.

## 10 · Identidad de la app

El nombre, el título visible y la URL viven en `lib/site.ts`. Importa desde ahí;
no repitas esos textos en otros archivos. `allflow.sentinels.json` lista los
únicos archivos donde AllFlow puede reemplazarlos, y
`pnpm test:sentinels` (en CI) falla si aparecen en otro lado.

## 11 · Antes de dar algo por terminado

```bash
pnpm build && pnpm tsc --noEmit && pnpm lint && pnpm test:sentinels
pnpm db:migrate && pnpm test:e2e   # con DATABASE_URL apuntando a un Postgres
```
