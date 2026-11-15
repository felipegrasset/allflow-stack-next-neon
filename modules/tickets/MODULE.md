# tickets — Tickets de soporte

> Lee solo este archivo y `manifest.json` para instalarlo, usarlo o quitarlo.

## Qué hace
Soporte con tickets, mensajes y estados. Cualquier persona con sesión abre un **ticket**
(asunto, descripción, prioridad), conversa con el equipo en su **hilo de mensajes** y puede
cerrarlo o reabrirlo. Cada persona ve **solo sus tickets**; quien tiene `ticket:manage` ve todos,
responde y cambia el estado desde `/admin/tickets`. Los avisos van por `notify()` y `notifyPermission()`.

Estados: `open` → `in_progress` → `resolved` → `closed` (el equipo mueve entre casi todos; quien
pidió solo puede cerrar y reabrir). Un ticket cerrado no admite mensajes hasta reabrirlo. Una
respuesta del equipo sobre un ticket abierto lo pasa a `in_progress`; una respuesta de quien
pidió sobre uno `resolved` lo reabre. Las reglas son funciones puras en `contracts/domain.ts`.

## Qué expone
- **Rutas:** `/tickets` (mis tickets + formulario, requiere `ticket:read`; el formulario, `ticket:create`),
  `/tickets/[id]` (hilo, respuesta y botones de estado; si no es tuyo y no tienes `manage`, 404) y
  `/admin/tickets` (todos, filtro `?status=`, requiere `ticket:manage`). Todas con sesión y onboarding.
- **Tablas** (migración `0118_tickets_init`):
  - `tickets`: `id`, `subject`, `status`, `priority` (`low|normal|high`), `requester_id`, `entity?` +
    `entity_id?` (registro de la app al que se refiere, **sin llave foránea**), `created_at`,
    `updated_at`, `closed_at`.
  - `tickets_messages`: `ticket_id` (cascade), `author_id`, `author_kind` (`requester|staff`), `body`, `created_at`.
  - `requester_id` y `author_id` son ids de `"user"` **sin llave foránea**, a propósito: el historial
    sobrevive al borrado de un usuario (la UI muestra «usuario eliminado»).
- **Permisos:** recurso `ticket`: `create`, `read`, `manage`. owner y admin reciben los tres; member,
  `create` y `read` (sus propios tickets). Se comprueban con `auth.api.hasPermission` de Better Auth
  (`server/guard.ts`), también en cada acción de servidor. `ticket:manage` es además `adminAccess`:
  abre la puerta de `/admin`, así que un rol propio con ese permiso llega al buzón sin ser admin.
- **Navegación:** enlace «Soporte» → `/tickets` (menú principal) y «Buzón de soporte» → `/admin/tickets`
  (`area: "admin"`, visible solo con `ticket:manage`).
- **Textos:** `messages.ts`, espacio `tickets` en `es` y `en`. Sin textos sueltos en la UI.
- **Entidades que cubre (`covers`):** ticket, tiquete, solicitud de soporte / support request, support ticket.

## `contracts/` (lo único importable por otro módulo)
```ts
import { openTicket, planReply, TICKET_STATUSES } from "@/modules/tickets/contracts"

// Abre un ticket como el usuario de la sesión (pide ticket:create) y avisa a los administradores.
const { ticketId } = await openTicket({
  subject: "No puedo pagar", body: "Me sale un error al confirmar",
  priority: "high", entity: "order", entityId: orderId,   // priority, entity y entityId son opcionales
})
```
También, puros: `canView`, `planStatusChange`, `availableStatusMoves`, `planReply`,
`messageRecipients`, `openTicketInputSchema`, `TICKET_STATUSES`, `TICKET_PRIORITIES` y los tipos.
`openTicket` es de servidor, necesita contexto de request (sesión) y lanza `Error` si no hay sesión,
falta el permiso o la entrada no es válida.

## Garantías (y dónde viven)
- Ver un ticket ajeno sin `manage` es 404 (no revela que existe): `canView` en páginas y en el store.
- Responder y cambiar de estado toman la fila del ticket con `FOR UPDATE` dentro de una transacción
  y re-aplican las reglas puras (`server/store.ts`); dos personas a la vez se serializan.
- Toda acción de servidor llama a `actionSession` (sesión + permiso) antes de tocar datos, valida con
  Zod (los mismos esquemas del formulario) y devuelve un error de texto localizado.
- Sin SQL concatenado: solo Kysely.

## Avisos (dependsOn `notifications`)
Best-effort (si falla se registra y la acción queda hecha), idempotentes por mensaje y persona:
- ticket nuevo o mensaje de quien pidió → todos los que tienen `ticket:manage` (roles estáticos y
  dinámicos, con `notifyPermission`; excluye a la autora; tope 50);
- mensaje del equipo → quien pidió (`notify`);
- cambio de estado hecho por otra persona → quien pidió.
El texto sale en el idioma de **quien actúa** (limitación de `notifications`, que guarda texto literal).

## Variables de entorno
Ninguna.

## Datos de ejemplo
`seed.ts` crea dos tickets y tres mensajes de ejemplo a nombre del primer usuario (ids fijos,
idempotente; si no hay usuarios, no hace nada). La «respuesta del equipo» del ejemplo queda con el mismo usuario como autor.

## Instalar
1. Copiar la carpeta a `modules/tickets/` (requiere `modules/notifications/`).
2. `pnpm modules:sync` (registros, permisos y shims de `/tickets`, `/tickets/[id]`, `/admin/tickets`).
3. `pnpm db:migrate` (aplica `0118_tickets_init` y corre el seed).
4. Opcional: `openTicket(...)` desde otro módulo (por ejemplo un botón «Reportar un problema» en un pedido).

## Desinstalar
Sigue «Desinstalar» en `modules/README.md`: `pnpm tsx scripts/modules.ts can-remove tickets`;
revertir `0118_tickets_init` (borra las dos tablas con sus mensajes) **antes** de borrar la carpeta;
luego borrar `modules/tickets/` y `pnpm modules:sync`.

## Límites conocidos (v0.1)
- Sin adjuntos, notas internas del equipo, asignación a una persona, etiquetas, SLA ni búsqueda por texto.
- Las listas muestran los 200 tickets más recientes (sin paginación).
- Los avisos al equipo llegan a un máximo de 50 personas con `ticket:manage` (si hay más, se registra y
  las demás no se enteran). El permiso lo trae también el rol `member` si alguien se lo concede.
- `/admin/tickets` pasa por el `proxy.ts` (sesión) y por la puerta de `/admin` (`adminAccess`): quien
  tiene `ticket:manage` entra aunque no sea admin. Requiere un template con el contrato `adminAccess`.
- Un solo ambiente y una sola organización (la de la app), como el resto del template.

## Pruebas
`tests/tickets.test.ts` (`node:test`): visibilidad, movimientos de estado, reglas de respuesta,
destinatarios de avisos (y que los avisos al equipo salgan por `notifyPermission`), esquemas Zod, paridad `es`/`en`, permisos, manifiesto y, leyendo el código,
las guardas de las acciones y el `FOR UPDATE`. **Sin probar contra base**: migración, consultas, seed,
concurrencia y avisos reales no se ejecutaron; las páginas no se renderizaron.

## Qué NO toca
Ningún archivo ancla ni zona protegida. De otros módulos importa solo `@/modules/notifications/contracts`
y `@/modules/i18n/contracts*`.
