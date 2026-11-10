# notifications — Notificaciones internas

> Lee solo este archivo y `manifest.json` para instalarlo, usarlo o quitarlo.

## Qué hace
Cada persona tiene su lista de avisos en `/notifications`, un enlace con el
contador de no leídas en la cabecera y un enlace en la navegación. Otros módulos
crean avisos con `notify()`. v0.1: sin popover, sin correo, sin tiempo real
(el contador se actualiza al navegar o al marcar).

## Qué expone
- **Ruta:** `/notifications` (cualquier usuario con sesión y onboarding; ve solo lo suyo).
- **Tabla `notifications`** (migración `0100_notifications_init`): `id` text pk,
  `user_id` → `"user".id` (cascade), `kind` (`info|success|warning|error`),
  `title`, `body?`, `href?` (ruta interna), `read_at?` (nulo = sin leer), `created_at`.
  Índices por `(user_id, created_at desc)` y parcial de no leídas.
- **Permisos:** recurso `notifications`: `read` (owner, admin y member; sobre lo propio)
  y `manage` (owner y admin; reservado para v0.2, hoy no se comprueba).
- **Navegación / cabecera:** enlace «Notificaciones» y, en la cabecera, un enlace con
  el contador (`header.tsx`, componente de servidor). Si la consulta falla, la
  cabecera muestra el enlace sin contador.
- **`contracts/`** (lo único importable por otro módulo):
  ```ts
  import { notify } from "@/modules/notifications/contracts"
  await notify({ userId, title: "Tu informe está listo", body?, href: "/reports/42", kind?: "info", id?: "clave-idempotente" })
  // → { id, created }   lanza ZodError si es inválido
  ```
  `href` debe ser una ruta interna (`/…`); se rechaza `//host`, `https://…` y `javascript:`.
  Con `id`, repetir la llamada no duplica el aviso (`created: false`).
  También exporta los tipos `Notification`, `NotifyInput`, `NotifyResult`, `NotificationKind`.
- **Acciones de servidor** (`server/actions.ts`): `markReadAction`, `markAllReadAction`;
  cada una llama a su guarda y solo toca filas del usuario de la sesión.

## Componentes reciclables (`ui/`)
Genéricos, solo tokens del tema (claro y oscuro), sin colores literales. Cópialos o
impórtalos desde otro módulo solo si se promueven a un kit; hoy son internos.
- `CountBadge({ count, max = 99, showZero?, className? })` y `formatCount(n, max)`: pastilla numérica, `aria-hidden`; el nombre accesible lo pone quien la usa.
- `EmptyState({ title, description?, action? })`: estado vacío sobre `components/ui/empty`.
- `ItemList<T>({ items, getKey, renderItem, label, empty })`: `<ul aria-label>` con estado vacío.

## Textos
Todos en `copy.ts` (un solo archivo). T4 (i18n) lo levantará a claves; mientras tanto
no hay literales en los componentes. `nav.ts` también importa de ahí.

## Variables de entorno
Ninguna. No envía correo (v0.1).

## Datos de ejemplo
`seed.ts` crea un aviso de bienvenida por usuario existente (`id = seed-welcome-<userId>`,
idempotente). Si no hay usuarios, no hace nada. La página sin avisos muestra el estado vacío.

## Instalar
1. Copiar la carpeta a `modules/notifications/`.
2. `pnpm modules:sync` (escribe `modules/_generated/*` y `app/(app)/notifications/page.tsx`).
3. `pnpm db:migrate`.
4. Opcional: `pnpm db:seed`.

## Desinstalar
1. Revertir la migración (`down` de `0100_notifications_init`, que borra la tabla y sus avisos) y borrar su fila de `kysely_migration` **antes** de borrar la carpeta.
2. Borrar `modules/notifications/`.
3. `pnpm modules:sync`. Si otro módulo importa `contracts`, quita primero esa llamada.

## Pruebas
`modules/notifications/tests/notifications.test.ts` (validación de `notify`, contador y render de los
componentes), corre con `pnpm test:modules`. No hay prueba contra base: no se aplicó la migración en ninguna base.

## Qué NO toca
Ningún archivo ancla ni zona protegida; no importa de otros módulos.
