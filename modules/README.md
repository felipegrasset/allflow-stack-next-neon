# modules/ — el contrato de módulos (T1)

Un **módulo** es una carpeta `modules/<id>/` que se instala sin editar ningún
archivo ancla de la génesis. Lo que sigue es el contrato completo; el ejemplo
vivo es `modules/_examples/ping/` y la plantilla, `modules/_template/`.

```
modules/
  contract/        el contrato: tipos, validador, generador, zonas (CODEOWNERS). No se toca desde un módulo.
  _generated/      lo escribe `pnpm modules:sync`. No se edita. La app lo importa.
  _template/       MODULE.md y manifest.json de partida
  _examples/ping/  módulo de ejemplo; las pruebas lo instalan en una copia
  <id>/            un módulo instalado
    MODULE.md      qué hace, qué expone, cómo se instala y se quita
    manifest.json  ver abajo
    contracts/     lo único que otro módulo puede importar
    db/migrations/ NNNN_<id>_<algo>.ts  (NNNN >= 0100)
    db/types.ts    agrega sus tablas a `Database` (ver abajo)
    ui/ server/    componentes y queries (solo tokens del tema, textos por clave)
    nav.ts permissions.ts header.tsx seed.ts messages.ts   los puntos de extensión, todos opcionales
```

## Qué toca instalar un módulo (y nada más)

| Dónde | Quién lo escribe |
|---|---|
| `modules/<id>/**` | se copia |
| `modules/_generated/{migrations,permissions,nav,seeds,messages}.ts` | `pnpm modules:sync` |
| el bloque «módulos» de `.env.example` (entre sus marcadores) | `pnpm modules:sync` |
| `app/(app)/<ruta>/page.tsx` (una línea: `export { default } from "@/modules/<id>/ui/page"`) | `pnpm modules:sync`, una por `routes[]` |

**No se edita:** `server/db/migrate.ts`, `server/db/schema/index.ts`,
`server/db/seed.ts`, `config/nav.ts`, `lib/permissions.ts` (anclas de la génesis,
que las edita por texto exacto), ni `components/ui/**` y `server/auth/**` (zonas
de solo lectura). `pnpm modules:guard` y el CI lo comprueban.

## `manifest.json`

El primer bloque calca `OverlayManifestEntry` de Forge (`feature`,
`dependencies`, `devDependencies`, `env`, `dependsOn`); el resto es del contrato.
Sin campo desconocido: el validador rechaza lo que no está en la lista. `files`
no existe: un módulo instalado es su carpeta entera.

| Campo | Regla |
|---|---|
| `id` | kebab-case, igual al nombre de la carpeta |
| `version` | semver |
| `tables` | `<id_con_guion_bajo>` o `<id_con_guion_bajo>_…` |
| `migrations` | `NNNN_<id_con_guion_bajo>[_…]`, NNNN >= 0100, archivo en `db/migrations/`, sin repetir número con otro módulo, numeradas después de las de sus `dependsOn` |
| `routes[]` | `{ path, entry, group? }`; `group` = `app` (por defecto, con sesión) o `marketing` (pública). Si `entry` se llama `route.ts` es un *route handler* (webhooks, callbacks): su shim va en `app/<path>/route.ts`, sin grupo, y re-exporta los verbos HTTP (`export *`). El `proxy.ts` solo protege `/settings`, `/admin` y `/onboarding`: un handler es público y se autentica solo |
| `covers` | opcional. Entidades del dominio que el módulo ya modela: minúsculas, singular, con sinónimos en español e inglés (`["producto", "product", "categoría", "category"]`). Sin vacíos ni repetidos; dos módulos instalados no pueden cubrir la misma entidad (se compara sin mayúsculas ni tildes). Ver «Entidades que cubre» |
| `entrypoints` | `nav` (exporta `nav`), `permissions` (exporta `permissions`), `header` (export default, componente de servidor), `seed` (exporta `seed(db)`, idempotente), `messages` (exporta `es` y `en`, ver «Textos») |

El validador también rechaza: importar archivos internos de otro módulo (solo su
`contracts/`), importar `_generated` (única excepción: `i18n` lee
`_generated/messages`), un color literal en `.tsx`, un `.ts` en
`db/migrations/` que el manifiesto no lista, un `MODULE.md` ausente, un
catálogo `messages` mal formado (`messages_invalid`) y un `covers` inválido o
repetido entre módulos (`covers_invalid`, `covers_conflict`).

## Migraciones: 0100+ y desordenadas

El core y la génesis usan `0001`–`0099`. Los módulos, `0100+`; los ejemplos,
`9xxx`. Se registran en `modules/_generated/migrations.ts` (el índice) y
`server/db/migrate.ts` crea el `Migrator` con `allowUnorderedMigrations: true`:
un módulo instalado después de que la app ya corrió migraciones propias tiene un
nombre menor que la última aplicada, y Kysely lo rechazaría. Una migración ya
aplicada **debe** seguir en la lista: revierte la del módulo antes de quitarlo.

## Tipar `Database`: fusión de interfaces

Un módulo agrega sus tablas sin editar `server/db/schema/index.ts`:

```ts
// modules/<id>/db/types.ts
declare module "@/server/db/schema" {
  interface Database { <id>_items: ItemsTable }
}
```

Probado con `tsc` (tests/modules-contract.test.ts): la consulta tipada compila y
una columna inexistente no. Se eligió esto sobre `interface Database extends
ModuleTables` porque la génesis ya reescribe esa línea (`extends GenesisTables`).

## Permisos y navegación

`permissions.ts` exporta `{ statement, grants?, adminAccess? }`;
`lib/permissions.ts` los suma a los roles. Por defecto `owner` y `admin`
reciben todo el `statement` y `member` nada. `nav.ts` exporta los enlaces del
módulo (ver «Dónde aparece un enlace») y `header.tsx` un componente de servidor
antes del selector de tema (un contador, un selector de idioma).

Toda página y toda acción de servidor comprueba **su** permiso con
`auth.api.hasPermission` (roles estáticos y dinámicos de `"organizationRole"`),
como `modules/tickets/server/guard.ts`, o con `can()` de
`@/server/module-access`:

```ts
import { can } from "@/server/module-access"
if (!(await can({ ticket: ["manage"] }))) forbidden()
```

Una página de administración **no** usa `requireAdmin()` (eso deja fuera a
quien tiene el permiso por un rol propio). `requireAdmin()` queda para lo que de
verdad es solo de admin, como `/admin/users`.

## Área de administración (`adminAccess`)

`app/(app)/admin/layout.tsx` es la puerta de `/admin/*` y llama a
`requireAdminArea()` (`server/module-access.ts`): deja pasar a `owner`/`admin`
**o** a quien tenga al menos un permiso que algún módulo instalado marcó como
`adminAccess`; al resto, 403. Es solo la puerta: cada página sigue comprobando su
permiso.

```ts
// modules/<id>/permissions.ts
export const permissions = {
  statement: { ticket: ["create", "read", "manage"] },
  grants: { member: { ticket: ["create", "read"] } },
  // Cualquiera de estos pares resource:action abre /admin (basta uno).
  adminAccess: { ticket: ["manage"] },
} as const satisfies ModulePermissions
```

- `pnpm modules:sync` los junta en `moduleAdminAccess`
  (`_generated/permissions.ts`); `tsc` falla si `adminAccess` nombra un recurso o
  una acción que no está en el `statement` del módulo (`_AdminAccessChecks`).
- `/admin` (sin nada más) redirige: admin → `/admin/users`; el resto → la primera
  entrada del área `admin` que puede ver; ninguna → 403.
- El menú de `/admin` (pestañas sobre la página) muestra a cada persona solo las
  entradas que puede abrir, y aparece cuando hay al menos un enlace de módulo.
- En la cabecera, quien pasa la puerta sin ser admin ve el enlace
  «Administración» (`/admin`); el admin sigue viendo «Usuarios».

## Dónde aparece un enlace (`area`, `permission`)

```ts
// modules/<id>/nav.ts
import type { ModuleNavItem } from "../contract/types"

export const nav: ModuleNavItem[] = [
  { href: "/tickets", label: "tickets.nav" },                       // área main, todos
  { href: "/admin/tickets", label: "tickets.nav.admin",
    area: "admin", permission: { ticket: ["manage"] } },            // menú de /admin
  { href: "/settings/plan", label: "plans.nav",
    area: "settings", permission: { plan: ["manage"] } },           // pestañas de /settings
]
```

| `area` | Dónde | Quién lo ve |
|---|---|---|
| `main` (por defecto) | navegación de la cabecera (`components/app-shell.tsx`) | según `adminOnly` / `permission` |
| `settings` | pestañas de `/settings`, tras Perfil y Seguridad | ídem |
| `admin` | menú de `/admin` | admin, o quien tenga `permission`; sin `permission`, solo admin |

Reglas de `isNavItemVisible` (`modules/contract/access.ts`): owner/admin ven
todo; con `permission` hace falta **todo** lo listado; `adminOnly` sin
`permission` es solo para admin; el resto, para cualquiera con sesión. Es solo
visibilidad: la página comprueba de nuevo. Las etiquetas se traducen igual que
antes (clave del catálogo del módulo). Los módulos sin `area` siguen en `main`,
como siempre.

## Variables de entorno (bloque generado)

Las `env` del manifiesto de cada módulo instalado aparecen en `.env.example`
dentro de un bloque que escribe `pnpm modules:sync`:

```
# --- módulos (generado por modules:sync) ---
# …
# ── storage ──
# Token de lectura y escritura del store de Vercel Blob (…). Secreto.
# BLOB_READ_WRITE_TOKEN=vercel_blob_rw_<storeId>_<secreto>
# --- fin módulos (generado por modules:sync) ---
```

- Ordenadas por id de módulo, **comentadas**, con su `description` y su
  `example`. Si dos módulos declaran la misma `key`, se escribe una vez y el
  segundo dice «la misma de X, más arriba».
- Lo que está fuera de los marcadores no se toca. Es idempotente; si ningún
  módulo declara `env`, el bloque desaparece. `pnpm modules:check` falla si el
  bloque está viejo o se editó a mano.
- Lo genera `buildEnvExample()` de `modules/contract/generate.ts` (el instalador
  de la plataforma debe llamarla igual que `buildRegistryFiles()`).

## Avisar por permiso (`notifyPermission`)

Para avisar a «todos los que pueden gestionar tickets» no se filtra por rol
`owner`/`admin`: se usa `notifications/contracts`, que resuelve los destinatarios
con roles estáticos y dinámicos, sin duplicados y con tope.

```ts
import { listUsersWithPermission, notifyPermission } from "@/modules/notifications/contracts"

await notifyPermission(
  { resource: "ticket", action: "manage" },
  { title: "Nuevo ticket", href: `/admin/tickets`, id: `ticket-new-${ticketId}` },
  { excludeUserIds: [authorId] },             // opcional; limit: 100 por defecto, 500 máx.
)
// → { userIds, truncated, created, failed }   (con id: la clave es "<id>:<userId>", idempotente)

const { userIds } = await listUsersWithPermission({ resource: "approval", action: "decide" })
```

No necesita sesión (sirve en webhooks y tareas). `notify()` no cambió.

## Textos (i18n): `entrypoints.messages`

Un módulo trae su propio catálogo; no se edita `modules/i18n/messages/`. Un
archivo (por convención `messages.ts`, en la raíz del módulo) exporta `es` (el
idioma fuente) y `en`. **La única clave de primer nivel es el id del módulo**,
así que todas sus claves quedan prefijadas (`ping.nav`, `ping.header.count`):

```ts
// modules/<id>/messages.ts   — copiable de modules/_template/messages.ts
import type { WidenMessages } from "@/modules/contract/types"

export const es = {
  "<id>": {
    nav: "Pedidos",
    title: "Tus pedidos",
    count: "{n, plural, =0 {Sin pedidos} one {# pedido} other {# pedidos}}",
    greeting: "Hola, {name}",
  },
} as const                                   // as const: así se leen los argumentos ICU

export const en: WidenMessages<typeof es> = { // el tipo exige las mismas claves
  "<id>": {
    nav: "Orders",
    title: "Your orders",
    count: "{n, plural, =0 {No orders} one {# order} other {# orders}}",
    greeting: "Hi, {name}",
  },
}
```

```json
"entrypoints": { "messages": "messages.ts" }
```

Reglas (las comprueba `modules:sync` sin ejecutar el archivo, y `tsc` a través
de `_generated/messages.ts`):

- Solo datos: objetos literales y textos literales. Nada de variables,
  funciones, spreads, concatenaciones ni claves calculadas, y ningún import que
  no sea `import type`.
- `es` y `en` con exactamente las mismas claves, ninguna vacía, y los mismos
  argumentos ICU en cada texto (`{name}`, `{n, plural, …}`).
- El id no puede coincidir con un espacio de nombres del núcleo (`auth`,
  `profile`, `i18n`): ahí gana el núcleo (`pnpm test:i18n` lo detecta).

Cómo se leen, desde el propio módulo (solo vía `contracts/` de `i18n`):

```ts
import { getModuleCopy } from "@/modules/i18n/contracts/server"  // servidor: páginas, cabecera, acciones
import { useModuleCopy } from "@/modules/i18n/contracts/client"  // componentes "use client"
import { es } from "../messages"

const copy = await getModuleCopy(es)   // o useModuleCopy(es)
copy.title             // "Tus pedidos" | "Your orders"
copy.count(3)          // un argumento ICU = un parámetro posicional
copy.greeting(name)
```

En `nav.ts`, `label` es la clave completa (`"<id>.nav"`): `AppShell` la traduce.
`pnpm modules:sync` junta todos los catálogos en `modules/_generated/messages.ts`;
`modules/i18n/request.ts` los fusiona bajo el catálogo del núcleo, así que
servidor y cliente (`NextIntlClientProvider`) los ven sin más. Fechas, números y
moneda: los formateadores de `@/modules/i18n/contracts`.

## Entidades que cubre: `covers` (H6)

Si la spec de una app tiene «Producto» y se instala un módulo de catálogo, no
puede haber dos tablas de productos. Por eso el manifiesto declara qué
entidades del dominio ya modela el módulo:

```json
"covers": ["producto", "product", "categoría", "category"]
```

- **La plataforma lee este campo**: antes de generar el modelo de datos, el
  analista cruza las entidades de la spec con los `covers` de los módulos que
  se van a instalar, y **no genera** las que un módulo cubre; usa las tablas y
  el `contracts/` del módulo.
- Minúsculas, singular, una entrada por nombre: el término en español y en
  inglés, y los sinónimos que razonablemente aparecerían en una spec.
- Sin vacíos ni repetidos; «categoría» y «categoria» cuentan como la misma.
  Dos módulos instalados no pueden cubrir la misma entidad.
- Solo lo que el módulo modela de verdad (una tabla propia), no lo que usa:
  `payments` no cubre «usuario».

## Instalar

1. Copiar la carpeta a `modules/<id>/`.
2. `pnpm modules:sync`: valida y escribe `modules/_generated/*` y un shim por ruta.
3. `pnpm install` si el manifiesto trae `dependencies`. Sus `env` ya quedaron
   comentadas en el bloque «módulos» de `.env.example`: copia a `.env.local` las
   que uses y complétalas.
4. `pnpm db:migrate`: aplica sus migraciones y corre su seed.
5. `pnpm modules:check && pnpm typecheck`.

## Desinstalar

Nunca se borra la carpeta de un módulo con migraciones aplicadas: Kysely falla
(«previously executed migration … is missing») porque la migración sigue en
`kysely_migration` y ya no está en la lista. El orden seguro:

1. **Verificar.** `pnpm tsx scripts/modules.ts can-remove <id>`. No borra nada
   ni toca la base: falla (código 1) si otro módulo lo declara en `dependsOn` o
   importa algo suyo, y lista las migraciones a revertir (de la más nueva a la
   más vieja), las tablas que se borran, los shims, las `env` y los `covers`.
   Si algo depende de él, se quita ese otro primero (o se deja).
2. **Respaldar.** El `down` borra sus tablas con los datos. Si importan, se
   exportan antes (`pg_dump -t '<prefijo>_*'`).
3. **Revertir sus migraciones**, contra la base de cada ambiente, con la carpeta
   todavía en su lugar:
   - Si son las últimas aplicadas (`select name, timestamp from kysely_migration
     order by timestamp desc`), `pnpm db:migrate:down` una vez por migración
     (revierte la última aplicada, por fecha).
   - Si no, un script de una vez que corre su `down` y borra su fila, en una
     transacción (y se borra el script después):

     ```ts
     // scripts/revert-<id>.ts   →  pnpm tsx --env-file-if-exists=.env.local scripts/revert-<id>.ts
     import { sql, type Kysely } from "kysely"
     import { getKysely } from "@/server/db/pool"
     import * as m0100 from "@/modules/<id>/db/migrations/0100_<id>_init"

     const db = getKysely() as unknown as Kysely<unknown>
     await db.transaction().execute(async (trx) => {
       // una línea por migración, de la más nueva a la más vieja
       await m0100.down(trx)
       await sql`delete from kysely_migration where name = ${"0100_<id>_init"}`.execute(trx)
     })
     await db.destroy()
     ```
4. **Quitar la carpeta** `modules/<id>/` y correr `pnpm modules:sync` (borra
   sus shims y sus registros, también su catálogo de textos).
5. Quitar sus `env` de `.env.local` (el bloque de `.env.example` ya lo limpió
   `modules:sync`) y, si nadie más las usa, sus `dependencies`.
   `pnpm modules:check && pnpm typecheck`.
6. Si tenía `covers`, esas entidades vuelven a ser de la génesis: la plataforma
   las genera en la próxima corrida si la spec las pide.

No hay borrado automático a propósito: revertir una migración pierde datos y
depende del ambiente; lo decide una persona.

## Comandos

```bash
pnpm modules:sync    # valida y escribe lo generado
pnpm modules:check   # igual, sin escribir; falla si algo está viejo (CI)
pnpm modules:guard   # falla si la rama toca una zona protegida o un ancla (CI)
pnpm tsx scripts/modules.ts can-remove <id>   # ¿se puede quitar? solo verifica
pnpm test:modules    # el contrato, con una instalación real en una copia
```

Un PR de actualización del template que deba tocar `components/ui/**` o
`server/auth/**` lleva la etiqueta `zonas-protegidas-ok`.

## Lo que este contrato todavía no resuelve

- **Desinstalar la base, automático:** `can-remove` verifica y planifica, pero revertir las migraciones es a mano (ver «Desinstalar»); a propósito, porque pierde datos.
- **Forge:** instalar un módulo en una app generada exige que la saga corra `pnpm modules:sync` después de copiar la carpeta (el overlay copia archivos, no genera los shims ni los registros).
- **`covers` en la plataforma:** el contrato lo declara y lo valida; que el analista de la génesis lo lea y omita esas entidades es trabajo del lado de la plataforma (allflow.biz).
- **Idiomas más allá de `es`/`en`:** un catálogo de módulo exporta exactamente `MODULE_MESSAGE_LOCALES` (`modules/contract/types.ts`, igual a `LOCALES` de i18n). Un idioma nuevo obliga a sumarlo ahí y en cada `messages` instalado.
- **Instalador de la plataforma:** copia el generador; debe copiar también `buildEnvExample` / `buildEnvBlock` / `ENV_*` (`generate.ts`), `modules/contract/access.ts` y los tipos nuevos (`ModuleNavArea`, `adminAccess`, `CheckAdminAccess`), y llamar a `buildEnvExample` al regenerar.
- **Permisos en la cabecera para módulos sin `area`:** `AppShell` ya filtra con `isNavItemVisible`; `moduleNavItems` de `config/nav.modules.ts` (que convierte un enlace con `permission` en `adminOnly`) queda solo por compatibilidad.
- **`adminAccess` y roles dinámicos viejos:** la fila `admin` de `"organizationRole"` se siembra una vez con los permisos de ese momento; no importa para la puerta de `/admin` (un admin pasa por su rol), pero un rol propio debe recibir a mano los permisos de módulos instalados después.
- **Destinatarios por permiso:** `listUsersWithPermission` cubre la organización de la app (una sola); calca `hasPermission` de Better Auth, salvo que una fila dinámica con JSON inválido solo anula ese rol (Better Auth fallaría entera).
- **Módulos con texto antiguo:** los que todavía guardan su texto en un `copy.ts` propio, en español (los kits, y los que siguen en `PENDING_LITERALS` de `tests/i18n.test.ts`), tienen que pasarse a `messages`; el punto de extensión ya existe.
