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
    nav.ts permissions.ts header.tsx seed.ts   los puntos de extensión, todos opcionales
```

## Qué toca instalar un módulo (y nada más)

| Dónde | Quién lo escribe |
|---|---|
| `modules/<id>/**` | se copia |
| `modules/_generated/{migrations,permissions,nav,seeds}.ts` | `pnpm modules:sync` |
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
| `entrypoints` | `nav` (exporta `nav`), `permissions` (exporta `permissions`), `header` (export default, componente de servidor), `seed` (exporta `seed(db)`, idempotente) |

El validador también rechaza: importar archivos internos de otro módulo (solo su
`contracts/`), importar `_generated`, un color literal en `.tsx`/`.css`, un
`.ts` en `db/migrations/` que el manifiesto no lista, y un `MODULE.md` ausente.

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

`permissions.ts` exporta `{ statement, grants? }`; `lib/permissions.ts` los suma
a los roles. Por defecto `owner` y `admin` reciben todo el `statement` y
`member` nada. `nav.ts` agrega enlaces tras la navegación principal
(`config/nav.modules.ts`) y `header.tsx` un componente de servidor antes del
selector de tema (un contador, un selector de idioma).

## Comandos

```bash
pnpm modules:sync    # valida y escribe lo generado
pnpm modules:check   # igual, sin escribir; falla si algo está viejo (CI)
pnpm modules:guard   # falla si la rama toca una zona protegida o un ancla (CI)
pnpm test:modules    # el contrato, con una instalación real en una copia
```

Un PR de actualización del template que deba tocar `components/ui/**` o
`server/auth/**` lleva la etiqueta `zonas-protegidas-ok`.

## Lo que este contrato todavía no resuelve

- **Desinstalar la base:** quitar un módulo con migraciones aplicadas es manual (ver `MODULE.md`).
- **Choque semántico con la génesis (H6):** si la spec tiene «Producto» y se instala `catalog`, hay dos tablas. El analista tiene que saber qué entidades cubre un módulo.
- **Forge:** instalar un módulo en una app generada exige que la saga corra `pnpm modules:sync` después de copiar la carpeta (el overlay copia archivos, no genera los shims ni los registros).
- **Textos por clave (i18n):** el módulo `i18n` ya existe, pero el contrato no tiene un punto de extensión para que un módulo aporte su propio catálogo: hoy se suma a mano a `modules/i18n/messages/`. El `label` de `nav.ts` puede ser una clave (`"ping.nav"`); `AppShell` la traduce, y lo que no es clave se muestra tal cual.
