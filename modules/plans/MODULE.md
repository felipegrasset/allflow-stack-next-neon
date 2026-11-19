# plans — Planes, límites y derechos (v0.2)

> Contrato en texto plano. Un agente que instala o usa este módulo lee SOLO este
> archivo y `manifest.json`.

## Qué hace
Responde **qué puede hacer** una persona (o cuenta) según el plan que paga:
`getPlan(subject)`, `can(subject, feature)`, `limit(subject, key)`. Lo hace
mapeando la suscripción **vigente** que informa `payments`
(`getActiveSubscription`: su `planRef`, el id del plan en el proveedor) a un plan
del catálogo de la app y a sus derechos.

Además (0.2):
- **`/admin/plans`**: el catálogo es real y editable desde la interfaz (crear,
  editar, publicar, archivar, plan por defecto, derechos).
- **`/settings/plan`**: cada persona ve su plan y puede **cambiar de plan** o
  **cancelar** su suscripción, si su proveedor lo permite.

**Dinero indirecto.** El precio y el cobro viven en el proveedor (Paddle, Mercado
Pago, Flow) y en `payments`. Este módulo no guarda precios, no cobra y no lee
tablas de `payments`: usa solo `@/modules/payments/contracts`
(`getActiveSubscription`, `startSubscription`, `changeSubscriptionPlan`,
`cancelSubscription`, `OperationNotSupportedError`, `SubscriptionChangeError`).
El campo «precio para mostrar» (`price_note_es/en`) es **solo un texto
informativo**, rotulado así en la interfaz.

## Qué expone
- **Rutas:**
  - `/settings/plan` (con sesión; pestaña de `/settings`): tu plan, por qué lo
    tienes, qué incluye, los planes a la venta, y cambiar / cancelar / contratar.
  - `/admin/plans` (permiso `plan:manage`; menú de `/admin`): el editor del catálogo.
- **Tablas:** `plans_plans` (clave, nombre y descripción `es`/`en`, `plan_ref`
  único, `is_default` — a lo más uno —, `active` (= no archivado), `published`
  (0128), `price_note_es/en` (0128, informativo), `sort`), `plans_entitlements`
  (`plan_id`, `key`, `kind` = `feature` | `limit`, `enabled`, `limit_value` —
  `null` = sin límite —, etiquetas `es`/`en`; único `(plan_id, key)`) y
  `plans_subscription_requests` (0128: el último cambio o cancelación que pidió
  cada sujeto, solo para mostrar «solicitado»; una fila por sujeto).
- **Permiso:** `plan:manage` (owner y admin; member nada), declarado también en
  `adminAccess` (abre `/admin` a un rol propio que lo tenga). Ver, cambiar o
  cancelar TU plan solo pide sesión.
- **Navegación:** «Plan» → `/settings/plan` (`area: "settings"`, todos);
  «Planes» → `/admin/plans` (`area: "admin"`, `permission: { plan: ["manage"] }`).
- **`contracts/`** (solo servidor): `getPlan`, `can`, `limit`, `getEntitlements`,
  `listPlans` (solo los planes **a la venta**), las funciones puras (`planCan`,
  `planLimit`, `hasRoom`, `subscriptionGrants`, `isSellable`, `planName`,
  `planPriceNote`…), los tipos y `PlansError`.

## Cómo se usa desde otro módulo
```ts
import { can, getEntitlements } from "@/modules/plans/contracts"

// un flag
if (!(await can(session.user.id, "export"))) forbidden()

// un límite, justo antes de crear (en el servidor, nunca en el navegador)
const ent = await getEntitlements(session.user.id)   // una lectura
if (!ent.hasRoom("projects", await countProjects(session.user.id)))
  return { ok: false, formError: "Llegaste al límite de tu plan" }
```
- `subject` es el mismo `subscriberRef` con que se llamó
  `payments.startSubscription`. En `/settings/plan` es `session.user.id`
  (`server/subject.ts`); una app B2B cambia esa función para usar el id de la
  organización y llama los contratos con ese mismo id.
- `limit` devuelve `Infinity` cuando es sin límite.
- Claves: minúsculas, empiezan con letra, `[a-z0-9_.-]`, hasta 64. Una clave
  mal formada lanza `TypeError`. Una clave que el catálogo no tiene → **no** / **0**.

## Reglas (fallan cerradas)
- **Vigencia:** el plan sale de `payments.getActiveSubscription` (la que da
  derecho HOY), no de `getSubscription` (la más reciente en cualquier estado).
  **Una suscripción `pending` (checkout abierto y no pagado) nunca le quita el
  plan a nadie**: probado con la regla de `payments` (`pickActiveSubscription`) y,
  como defensa, `resolvePlan` vuelve a aplicar `subscriptionGrants` (`active`
  siempre; `past_due` / `canceled` solo hasta `current_period_end`; lo demás nunca).
- Sin suscripción que otorgue → el plan por defecto. Sin plan por defecto →
  ninguno (`can` false, `limit` 0).
- Suscripción vigente con un `plan_ref` que no está en el catálogo → plan por
  defecto y `unmappedPlanRef` lo avisa (la página muestra un aviso).
- Un plan **archivado** o **no publicado** no se ofrece, pero sigue valiendo para
  quien ya lo paga (se busca por `plan_ref` sin filtrar).
- Una clave tiene **un solo tipo** en todo el catálogo (no puede ser límite en un
  plan y opción en otro): `setEntitlement` lo comprueba con un candado consultivo
  por clave dentro de la transacción. Para cambiarle el tipo a una clave, quítala
  de todos los planes primero.

## Catálogo (`/admin/plans`)
- **Crear** un plan: clave (fija después), nombres y descripciones `es`/`en`,
  `plan_ref`, orden y precio para mostrar. **Nace como borrador** (`published = false`).
- **Editar** todo lo anterior salvo la clave. `plan_ref` validado
  (`[A-Za-z0-9][A-Za-z0-9_.:@-]{0,199}`) y único (`ref_taken`).
- **Publicar** exige `plan_ref` y no estar archivado; un plan publicado no puede
  quedarse sin `plan_ref` (`ref_required`: primero «Dejar de vender»).
- **Archivar** despublica, no borra y no le quita el plan a quien lo paga.
  **El plan por defecto no se archiva sin elegir otro**: la interfaz pide el
  reemplazo y el servidor cambia el por defecto y archiva en la misma transacción.
  Desarchivar no republica.
- **Plan por defecto:** uno solo; cambiarlo es atómico (en una transacción se
  desmarca el anterior y se marca el nuevo; índice único parcial de respaldo). Un
  plan archivado no puede ser por defecto.
- **Derechos:** agregar, editar (upsert por clave) y quitar opciones sí/no y
  límites numéricos. Cambian de inmediato para quienes ya pagan.
- **Qué le falta para venderse:** cada plan muestra su lista (id del proveedor,
  desarchivar, publicar) y un aviso si no define derechos (`saleChecklist`).
- **Sin borrado duro** en v0.2.
- **Garantías en la base (0128):** `check (not published or (plan_ref is not null and active))`
  y `check (not is_default or active)`.
- Toda acción: sesión → `plan:manage` → Zod → transacción con `for update` sobre
  las filas que decide → mensaje traducido (nunca el error crudo).

## Cambiar y cancelar (`/settings/plan`)
Qué se ofrece lo decide `subscriptionOptions` (puro, probado):

| Situación | Qué se ofrece |
|---|---|
| Sin suscripción que otorgue | Contratar un plan a la venta |
| `active`, Paddle | Cambiar a otro plan a la venta; cancelar |
| `active` con cancelación programada | Nada (aviso con la fecha) |
| `past_due`, Paddle | Solo cancelar (Paddle no cambia de plan con cobro atrasado) |
| `canceled` con período pagado vigente | Contratar otro plan |
| `active` con Mercado Pago o Flow | Nada: se explica que el cambio se hace cancelando con el proveedor y contratando de nuevo |

- Los proveedores que soportan cambiar/cancelar están en `PLAN_CHANGE_PROVIDERS`
  / `CANCEL_PROVIDERS` (hoy `["paddle"]`), copiado de la documentación de
  `payments` 0.2 porque `payments` no expone una consulta de capacidades. Si se
  desalinea, la acción igual atrapa `OperationNotSupportedError` y lo explica.
- **Cambio:** antes de confirmar, un diálogo dice cómo cobra el proveedor (Paddle:
  prorratea lo que queda del período y lo cobra en ese momento; en una baja deja
  crédito; si el cobro falla, no aplica el cambio — texto de `payments`, sin montos).
- **Cancelar:** al fin del período por defecto; «ahora mismo» es una opción
  explícita que avisa que no se devuelve lo no usado.
- **Nada se da por hecho al pedirlo:** la acción guarda el pedido en
  `plans_subscription_requests` y la página muestra «solicitado, se confirma
  cuando el proveedor avise» mientras `getActiveSubscription` no lo refleje
  (hasta 30 minutos, `REQUEST_WAIT_MS`); el plan mostrado es siempre el real.
  Mientras hay un pedido esperando no se ofrecen otros botones (`request_pending`).
- `SubscriptionChangeError` (`not_found`, `not_active`, `already_canceled`,
  `same_plan`) tiene mensaje propio (`SUBSCRIPTION_CHANGE_ERRORS`; `tsc` falla si
  `payments` agrega un código sin traducir).
- El navegador solo manda el id del plan (o «al fin del período»); `plan_ref` y el
  sujeto salen del servidor.
- Contratar teniendo una suscripción que todavía cobra no se ofrece (cobraría dos
  veces): para eso está el cambio.

## Datos de ejemplo (`seed`, idempotente)
`gratis` (por defecto, sin `plan_ref`), y `pro` y `equipo` como **borradores sin
`plan_ref`, no publicados**: el seed no deja nada contratable. Derechos `projects`
y `members` (límites), `export` y `priority_support` (opciones). No pisa planes
ni derechos existentes ni marca `gratis` por defecto si ya hay otro.
**Para vender:** crea el plan con su precio en el proveedor, pega su id en
`/admin/plans` y publícalo.

La migración 0128 limpia los `plan_ref` inventados de la v0.1
(`ejemplo-plan-%`) y deja publicados los planes activos que ya tenían un
`plan_ref` real (lo que en v0.1 significaba «a la venta»).

## Límites conocidos (v0.2)
- La lista de proveedores que soportan cambio/cancelación está copiada de la
  documentación de `payments` (ver arriba).
- El pedido de cambio/cancelación se recuerda solo para mostrarlo; si el
  proveedor nunca confirma, el aviso desaparece a los 30 minutos y se puede
  volver a pedir.
- Un `plan_ref` por plan: el mismo plan vendido en dos proveedores necesita dos
  planes (con los mismos derechos).
- Sin caché: cada `getPlan` son 2–3 consultas. Para varias preguntas usa `getEntitlements`.
- No hay medición de uso: el módulo dice el límite, la app cuenta lo usado.
- Quien no tiene `plan:manage` pero entra a `/admin` por otro módulo y abre
  `/admin/plans` recibe 403 (la página comprueba su permiso).
- Reactivar una suscripción con cancelación programada no está soportado
  (`payments` no lo ofrece).

## Pruebas
- `tests/plans.test.ts` (`node:test`, sin base) — **ejecutadas: 38/38 pasan**
  (transpiladas con `transpileModule` a una carpeta temporal). Cubren: reglas de
  otorgamiento; que una `pending` más nueva no quita el plan (con
  `pickActiveSubscription` de `payments/contracts`); resolución con dependencias
  inyectadas; reglas de publicación, archivo y plan por defecto; qué acciones se
  ofrecen según proveedor y estado; el aviso de pedido pendiente; esquemas Zod;
  catálogo `es`/`en`; seed sin nada contratable; manifiesto; y, leyendo el
  código, que cada Server Action va sesión → permiso → Zod → datos, que la página
  de admin comprueba `plan:manage`, que no se usa `getSubscription` y que
  `payments` se usa solo por su `contracts/`.
- `tests/plans-db.test.ts` (Postgres, crea su schema): 0128 sobre un catálogo
  v0.1, seed idempotente sin nada a la venta, publicar/archivar/plan por defecto,
  unicidad de `plan_ref`, `setDefaultPlan` concurrente, checks de la tabla, claves
  con un solo tipo y pedidos. **Escrita, NO ejecutada** (no había Postgres).
- **Sin probar:** las páginas y los diálogos en un navegador, y el cambio /
  cancelación contra Paddle real (sandbox).

## Instalar
1. Requiere `payments` 0.2 o superior (con `getActiveSubscription`,
   `changeSubscriptionPlan`, `cancelSubscription`), con sus migraciones antes que 0125.
2. Copiar la carpeta a `modules/plans/` y `pnpm modules:sync` (registra 0125 y
   0128, el permiso y `adminAccess`, la navegación, los textos y los shims
   `app/(app)/settings/plan/page.tsx` y `app/(app)/admin/plans/page.tsx`).
3. `pnpm db:migrate` (aplica 0125 y 0128 y corre el seed).
4. En `/admin/plans`, poner los `plan_ref` reales y publicar.

## Desinstalar
1. `pnpm tsx scripts/modules.ts can-remove plans`.
2. Revertir 0128 y después 0125 (`down`) y sus filas en `kysely_migration`, con
   la carpeta todavía en su lugar.
3. Borrar `modules/plans/` y `pnpm modules:sync`.
Las suscripciones de `payments` no se tocan.

## Qué NO toca
Ningún archivo fuera de `modules/plans/`, ningún ancla ni zona protegida, ni
las tablas de `payments`.
