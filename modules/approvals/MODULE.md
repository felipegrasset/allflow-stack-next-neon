# approvals — Flujos de aprobación

> Lee solo este archivo y `manifest.json` para instalarlo, usarlo o quitarlo.

## Qué hace
Pone cualquier registro de la app (un gasto, una orden de compra, un documento) bajo un
flujo de estados con aprobación: quien lo pide abre una **solicitud**, las personas con el
rol indicado la mueven de estado (aprobar, rechazar, pedir cambios…) y cada paso queda en un
**historial con autor**. El flujo es **datos**: estados y transiciones válidas, cada una con
los roles que pueden ejecutarla, validados con Zod. Una transición inválida es siempre un
error (`ApprovalError`), nunca un no-op silencioso.

La bandeja `/approvals` muestra «Por decidir» (solicitudes de otros donde puedes actuar) y
«Mis solicitudes»; `/approvals/[id]` muestra el detalle, el historial y los botones de decisión.

## Qué expone
- **Rutas:** `/approvals` (bandeja) y `/approvals/[id]` (detalle), ambas con sesión y
  onboarding. El detalle solo lo ve quien pidió la solicitud o quien tiene `approval:decide`
  (si no, 404).
- **Tablas** (migración `0107_approvals_init`):
  - `approvals_flows`: `id`, `key` único, `definition` jsonb (validada), `active`, fechas.
  - `approvals_requests`: `flow_id` → `approvals_flows` (restrict), `flow_key`, `definition`
    (**copia del flujo al crear**: editar el flujo no deja solicitudes en estados que ya no
    existen), `entity` + `entity_id` (**sin llave foránea**), `title`, `href?`, `state`,
    `requested_by`, `created_at`, `updated_at`, `closed_at` (no nulo = llegó a un estado final).
    Índice único parcial: **una sola solicitud abierta por flujo y registro**.
  - `approvals_events`: `request_id` (cascade), `actor_id`, `action` (`request` en la
    creación), `from_state?`, `to_state`, `comment?`, `created_at`. **Solo se inserta**: un
    trigger rechaza todo `UPDATE`.
  - `requested_by` y `actor_id` son ids de `"user"` **sin llave foránea**, a propósito: el
    historial sobrevive al borrado de un usuario (la UI muestra «usuario eliminado»).
- **Permisos:** recurso `approval` con `request` y `decide`. owner y admin reciben ambos;
  member solo `request`. Se comprueban con `auth.api.hasPermission` de Better Auth (suma los
  roles estáticos y los dinámicos de `organizationRole`) contra la organización de la app.
  Ejecutar una transición exige **las dos cosas**: que el flujo liste uno de tus roles **y** el
  permiso `approval:decide`. Las transiciones de `$requester` (cancelar, reenviar) exigen ser
  quien pidió y `approval:request`.
- **Navegación:** enlace «Aprobaciones» → `/approvals`. Sin cabecera.
- **Textos:** `messages.ts`, espacio `approvals` en `es` y `en` (`inbox.*`, `request.*`,
  `detail.*`, `errors.<código>`, `notify.*`). Los nombres de flujos, estados y acciones NO están
  ahí: son datos del flujo (`{ es, en }`).
- **Entidades que cubre (`covers`):** aprobación / approval, solicitud de aprobación /
  approval request. NO cubre la entidad aprobada (gasto, orden…): esa es de la app.

## Cómo se define un flujo
```ts
import { defineFlow, saveFlow } from "@/modules/approvals/contracts"

const gasto = {
  key: "gasto",                                   // [a-z0-9_-]
  name: { es: "Gasto", en: "Expense" },
  initial: "pending",
  allowSelfApproval: false,                       // por defecto: nadie decide su propia solicitud por rol
  states: [
    { key: "pending",  label: { es: "Pendiente", en: "Pending" } },
    { key: "approved", label: { es: "Aprobado",  en: "Approved" }, final: true },
    { key: "rejected", label: { es: "Rechazado", en: "Rejected" }, final: true },
  ],
  transitions: [
    { action: "approve", from: "pending", to: "approved", label: { es: "Aprobar", en: "Approve" }, roles: ["admin", "owner"] },
    { action: "reject",  from: "pending", to: "rejected", label: { es: "Rechazar", en: "Reject" }, roles: ["admin"], comment: "required" },
  ],
}
await saveFlow(gasto)   // valida y hace upsert por `key`
```
Reglas que valida `defineFlow` (si no, `ApprovalError("invalid_flow")` con todos los
problemas): claves de estado únicas; `initial` existe y no es final; al menos un final; ningún
final tiene salidas; `from`/`to` existen y son distintos; `action` única por `from`; todo
estado no final tiene salida; todo estado es alcanzable desde `initial`; `roles` no vacío
(nombres de rol de la organización o `$requester`); `comment`: `none | optional | required`.
Ejemplos completos en `flows.ts` (`aprobacion-simple`, `gasto-dos-niveles`).

## `contracts/` (lo único importable por otro módulo)
```ts
import { requestApproval, decide, getStatus, canTransition, ApprovalError } from "@/modules/approvals/contracts"

// Abre una solicitud como el usuario de la sesión (pide approval:request). Avisa a los que pueden decidir.
const { requestId } = await requestApproval({ flowKey: "gasto", entity: "expense", entityId: id,
  title: "Taxi aeropuerto — $18.500", href: `/expenses/${id}`, comment?: "…" })

// Ejecuta una transición como el usuario de la sesión. expectedState es opcional (control optimista).
await decide({ requestId, action: "approve", comment?: "ok", expectedState?: "pending" })
// → { requestId, eventId, from, to, final }

// Estado del registro: la solicitud abierta o, si no hay, la última cerrada; null si nunca tuvo.
const s = await getStatus("expense", id, { flowKey?: "gasto" })
// → { requestId, state, stateLabel, final, closedAt, requestedBy, … } | null   (SIN chequeo de permiso)

// Puro: ¿puede este actor ejecutar esta acción? (roles y $requester; no mira permisos)
canTransition(flow, { state, action, actor: { userId, roles }, requestedBy })
// → { ok: true, transition, asRequester } | { ok: false, reason }
```
También: `saveFlow`, `defineFlow`, `availableTransitions`, `localize`, `REQUESTER_ROLE`,
`flowDefinitionSchema`, `requestApprovalInputSchema`, `decideInputSchema` y los tipos.

Errores (`ApprovalError.code`): `unauthenticated`, `forbidden`, `invalid_input`,
`invalid_flow`, `flow_not_found`, `flow_inactive`, `request_not_found`, `already_open`,
`invalid_transition`, `self_approval`, `comment_required`, `conflict`.

`requestApproval`, `decide`, `getStatus` y `saveFlow` son de servidor y necesitan contexto de
request (leen la sesión y el idioma): **no sirven desde un job sin request** en v0.1.
`getStatus` y `saveFlow` no comprueban permisos: quien los llama decide quién ve el registro o
quién puede editar flujos.

## Garantías (y dónde viven)
- Transición inválida, sin rol, sin permiso, sobre solicitud cerrada o con comentario
  obligatorio vacío → error con código (`server/decision.ts`, probado).
- Dos personas decidiendo a la vez: `decide` toma la fila con `FOR UPDATE` dentro de una
  transacción y actualiza con `where state = from`; la segunda falla (`invalid_transition` o
  `conflict`), nunca se pisan.
- Una sola solicitud abierta por flujo + registro: índice único parcial (`already_open`).
- Cada cambio deja un evento con autor en la misma transacción; los eventos no se editan (trigger).
- La acción de servidor (`decideAction`) llama a `requireOnboardedUser`, valida con Zod y pasa
  por `decide`, que vuelve a comprobar rol, permiso y estado.

## Avisos (dependsOn `notifications`)
Tras crear o mover una solicitud, con `notify()` (idempotente por evento y persona):
- a los miembros cuyo rol aparece en alguna transición que sale del nuevo estado (salvo quien
  actuó y, sin `allowSelfApproval`, quien pidió), si el estado no es final;
- a quien pidió, si lo movió otra persona.
Es best-effort: si falla, se registra en consola y la decisión queda hecha. El texto del aviso
sale en el idioma de **quien actúa** (limitación de `notifications`, que guarda texto literal).

## Variables de entorno
Ninguna.

## Datos de ejemplo
`seed.ts` guarda los flujos `aprobacion-simple` y `gasto-dos-niveles` si su `key` está libre
(idempotente; nunca pisa un flujo ya editado). No siembra solicitudes: apuntan a registros
reales de la app. Sin solicitudes, la bandeja muestra dos estados vacíos.

## Instalar
1. Copiar la carpeta a `modules/approvals/` (requiere `modules/notifications/`).
2. `pnpm modules:sync` (registros y shims de `/approvals` y `/approvals/[id]`).
3. `pnpm db:migrate` (aplica `0107_approvals_init` y corre el seed).
4. Desde la app o desde otro módulo: `saveFlow(...)` con sus flujos y `requestApproval(...)`
   donde corresponda (por ejemplo, al enviar un gasto).

## Desinstalar
Sigue «Desinstalar» en `modules/README.md`:
1. `pnpm tsx scripts/modules.ts can-remove approvals`.
2. Revertir `0107_approvals_init` (borra las tres tablas y la función del trigger, con su
   historial) **antes** de borrar la carpeta.
3. Borrar `modules/approvals/` y `pnpm modules:sync`.

## Límites conocidos (v0.1)
- No hay pantalla para crear o editar flujos: se definen en código con `saveFlow` (o el seed).
- «Por decidir» revisa las 200 solicitudes abiertas más antiguas y filtra en memoria
  (la definición vive en cada solicitud); con más volumen hace falta otra estrategia.
- Los avisos eligen destinatarios por nombre de rol, sin volver a comprobar `approval:decide`
  de cada uno; no avisa a roles definidos solo en `organizationRole` si el flujo no los nombra.
- Sin plazos, recordatorios, delegación ni aprobaciones en paralelo (N de M).
- Un flujo de una sola organización (la de la app), como el resto del template.

## Pruebas
`tests/approvals.test.ts` (`node:test`): validador de flujos, motor de transiciones,
`$requester` y auto-aprobación, reglas de `planDecision` (permiso, comentario obligatorio,
estado viejo, solicitud cerrada), esquema de entrada, paridad `es`/`en`, permisos y, leyendo el
código, la guarda de la acción y el `FOR UPDATE`. Corrido: 11/11 transpilado con `tsc` + `node
--test`. **Sin probar contra base**: la migración, las consultas, el trigger, el índice único y
la concurrencia no se ejecutaron en ninguna base; las páginas no se renderizaron.

## Qué NO toca
Ningún archivo ancla ni zona protegida. De otros módulos importa solo
`@/modules/notifications/contracts` y `@/modules/i18n/contracts*`.
