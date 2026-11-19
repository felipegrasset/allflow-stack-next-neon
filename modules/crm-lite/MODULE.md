# crm-lite — CRM liviano

> Lee solo este archivo y `manifest.json` para instalarlo, usarlo o quitarlo.

## Qué hace
Un CRM para un equipo chico, dentro de la app (con sesión):

- **Contactos** (`/crm/contacts`): lista con búsqueda por nombre, correo o empresa, y
  formulario para crear. Cada contacto es **prospecto** (`lead`) o **cliente** (`customer`).
- **Ficha del contacto** (`/crm/contacts/[id]`): editar sus datos, ver y crear sus
  oportunidades, y su línea de tiempo de actividad (registrar nota, llamada, correo o
  reunión, opcionalmente atada a una de sus oportunidades).
- **Pipeline** (`/crm`): tablero kanban con seis etapas fijas — `new`, `qualified`,
  `proposal`, `negotiation`, `won`, `lost`. Las tarjetas se arrastran entre columnas
  (`@dnd-kit/core`, con mouse, toque o teclado) y además cada tarjeta tiene un selector
  de etapa, para quien no puede o no quiere arrastrar. Cada columna muestra cuántas
  oportunidades tiene y el total **por moneda** (nunca suma monedas distintas).

Reglas del dominio:
- **Dinero:** entero en la **unidad menor** de la moneda (`amount_minor bigint`, CLP en
  pesos, USD en centavos) + código ISO 4217. La persona escribe el monto en unidades
  mayores («1.500.000», «1500,50») y `parseAmount` lo convierte sin coma flotante. Monedas
  del formulario: CLP (por defecto), USD, EUR, MXN, ARS, COP, PEN, BRL (`CURRENCIES`).
- **Mover una oportunidad** es optimista en la UI y atómico en la base: el `UPDATE` solo
  aplica si la oportunidad sigue en la etapa de origen (si otra persona la movió antes,
  responde `conflict` y la tarjeta vuelve). En la misma transacción se registra una
  actividad `stage_change` (de → a, con autor).
- `closed_at` se fija al pasar a `won`/`lost` y se limpia al reabrir (lo impone un
  `check` de la tabla). **Ganar** una oportunidad pasa su contacto a cliente; nada lo
  devuelve a prospecto automáticamente.
- El correo de un contacto se guarda en minúsculas y es único (índice parcial: los
  contactos sin correo no chocan).

## Qué expone
- **Rutas:** `/crm` (`ui/pipeline-page.tsx`), `/crm/contacts` (`ui/contacts-page.tsx`),
  `/crm/contacts/[id]` (`ui/contact-page.tsx`). Grupo `app`.
- **Tablas** (migración `0105_crm_lite_init`):
  - `crm_lite_contacts`: `id`, `name`, `email?` (minúsculas, único), `phone?`, `company?`,
    `status` (`lead|customer`), `notes?`, `owner_id?` → `"user"` (set null), `created_at`, `updated_at`.
  - `crm_lite_deals`: `id`, `contact_id` → contacto (cascade), `name`, `amount_minor`
    bigint ≥ 0, `currency` (`^[A-Z]{3}$`), `stage`, `owner_id?`, `closed_at?`, fechas.
  - `crm_lite_activities`: `id`, `contact_id` (cascade), `deal_id?` (set null), `kind`
    (`note|call|email|meeting|stage_change`), `body?`, `from_stage?`, `to_stage?`,
    `author_id?` → `"user"` (set null), `created_at`.
- **Permisos** (Better Auth, `permissions.ts`): `contact: read, write`, `deal: read, write`.
  owner, admin **y member** reciben los cuatro (un CRM es de todo el equipo); una app que
  quiera miembros de solo lectura lo restringe con un rol dinámico (`"organizationRole"`).
  Cada página y cada acción comprueba con `auth.api.hasPermission` sobre la organización
  de la app (`server/guard.ts`): sin `read` la página responde 403; sin `write` no se
  muestran formularios ni el arrastre, y la acción responde «sin permiso».
  - Ver pipeline: `deal:read`. Mover: `deal:write`.
  - Ver contactos y actividad: `contact:read`. Crear/editar contacto y registrar
    actividad: `contact:write`. Crear oportunidad: `contact:read` + `deal:write`.
- **Navegación:** «Pipeline» (`/crm`) y «Contactos» (`/crm/contacts`).
- **Textos:** `messages.ts` (`crm-lite.*`, `es` y `en`). Fechas y montos con los
  formateadores de `@/modules/i18n/contracts` en el idioma activo.
- **Entidades que cubre (`covers`):** contacto/contact, cliente/customer/client,
  prospecto/prospect/lead, oportunidad/opportunity, negocio/deal, actividad/activity.
  La génesis no debe generar esas tablas: usa las de este módulo y su `contracts/`.

## Cómo se usa desde otro módulo (`contracts/`)
```ts
import { upsertContact, logActivity, getContact, listContactDeals } from "@/modules/crm-lite/contracts"

// Un formulario público capturó un prospecto:
const { id, created } = await upsertContact({ name: "Ana Rojas", email: "ana@ejemplo.cl", company: "Ejemplo SpA" })
await logActivity({ contactId: id, kind: "note", body: "Pidió una cotización desde la web" })
```
- `upsertContact`: crea, o si el correo ya existe completa solo los campos vacíos
  (teléfono, empresa); `status: "customer"` asciende, nunca baja. Sin correo, siempre crea.
- `logActivity`: `kind` ∈ `note|call|email|meeting`; `dealId` opcional y debe ser de ese
  contacto (si no, devuelve `null`). `authorId` opcional.
- `getContact(id)`, `listContactDeals(contactId)`.
- También: tipos (`Contact`, `Deal`, `Activity`, `DealStage`…), `DEAL_STAGES`,
  `CURRENCIES`, `parseAmount`, `minorToMajor`, y los esquemas Zod de entrada.
- **Son funciones de servidor y NO comprueban permisos**: son para código de servidor de
  confianza (un webhook, una acción de otro módulo que ya comprobó lo suyo). Validan con
  Zod y lanzan `ZodError` si la entrada es inválida.

## Variables de entorno y dependencias
Ninguna variable. Usa solo paquetes que el template ya trae (`@dnd-kit/core`, `zod`,
`react-hook-form`, `kysely`, `next-intl`, `lucide-react`). Sin `dependsOn`.

## Datos de ejemplo
`seed.ts`: 4 contactos, 5 oportunidades y 3 actividades inventados (ids `seed-crm-*`,
`on conflict do nothing`: idempotente y nunca pisa lo editado).

## Instalar
1. Copiar la carpeta a `modules/crm-lite/`.
2. `pnpm modules:sync` (registros y los tres shims de `app/(app)/crm/…`).
3. `pnpm db:migrate` (aplica `0105_crm_lite_init` y corre el seed).
4. `pnpm modules:check && pnpm typecheck`.

## Desinstalar
`pnpm tsx scripts/modules.ts can-remove crm-lite`; respaldar (`pg_dump -t 'crm_lite_*'`);
revertir `0105_crm_lite_init` (su `down` borra las tres tablas con sus datos) y borrar su
fila de `kysely_migration` **antes** de borrar la carpeta; luego borrar la carpeta y
`pnpm modules:sync`. Si otro módulo importa `crm-lite/contracts`, quitar eso primero.

## Pruebas
`tests/crm-lite.test.ts` (`node:test`, sin base): conversión de montos a unidad menor,
plan de movimiento de etapa, escape de la búsqueda, esquemas Zod, paridad `es`/`en` del
catálogo, manifiesto vs. archivos, y —leyendo el código— que cada acción comprueba sesión
y permiso antes de validar y escribir, y que el movimiento va condicionado a la etapa de
origen dentro de una transacción.

**Sin probar:** nada corrió contra una base (la migración, las consultas, el upsert por
correo, la carrera de dos movimientos simultáneos y el seed solo se verificaron con
`tsc`), ni se renderizó en un navegador (arrastrar y soltar, anuncios del lector de
pantalla, `useOptimistic`), ni `next build`.

## Límites conocidos (v0.1)
- Etapas fijas en código (`DEAL_STAGES`); no hay etapas por equipo ni orden manual de
  tarjetas dentro de una columna (se ordenan por última modificación).
- El tablero carga hasta 500 oportunidades y la lista hasta 200 contactos, sin paginación.
- No se borran contactos ni oportunidades desde la UI; tampoco se edita una oportunidad
  (solo se crea y se mueve). Sin fecha estimada de cierre ni probabilidad.
- `owner_id` se guarda (quien crea) pero no se muestra ni se filtra por él: todo el equipo
  con permiso ve todo.
- Sin importación CSV (la hará el módulo `csv-import`) ni avisos (`notifications`).

## Qué NO toca
Ningún archivo ancla ni zona protegida; no importa de otros módulos salvo
`@/modules/i18n/contracts` (textos y formato).
