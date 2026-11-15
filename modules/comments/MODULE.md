# comments — Comentarios y menciones

> Lee solo este archivo y `manifest.json` para instalarlo, usarlo o quitarlo.

## Qué hace
Un hilo de comentarios de **texto plano** sobre cualquier registro de la app (un pedido, una tarea,
un cliente…). Quien comenta puede **mencionar** a otra persona escribiendo `@Nombre`; a esa persona le
llega un aviso con `notify()`. Se borra solo por su autor o por quien tiene `comment:delete`. No se editan.

## Lo importante: quién puede ver el registro
El módulo **no conoce las entidades de la app**, así que no sabe quién puede ver un pedido o una tarea.
Por eso el llamador debe pasar `canAccess`, una comprobación de acceso **obligatoria**:

```tsx
import { Comments } from "@/modules/comments/contracts/comments"

<Comments
  entity="order"                       // tipo de registro: minúsculas, [a-z0-9_.-], máx. 63
  id={order.id}                        // id del registro, máx. 200
  href={`/orders/${order.id}`}         // ruta relativa de la página que muestra el hilo (a donde lleva el aviso)
  canAccess={async ({ userId, entity, entityId }) => userCanSeeOrder(userId, entityId)}
/>
```
- `canAccess` se llama para quien mira **y** para cada persona que podría ser mencionada. Quien no pueda
  ver el registro no aparece en la lista de menciones y no recibe aviso.
- **Sin sesión, con argumentos inválidos, o si `canAccess` no devuelve `true` (o lanza), no se muestra
  nada** (ni hilo ni formulario). No hay modo «público».
- Las acciones de servidor se pueden llamar por POST directo y no pueden invocar la función de la app. Por
  eso `<Comments>` entrega al cliente un **token firmado** (HMAC-SHA256 con `BETTER_AUTH_SECRET`, vence a las
  2 h) con: la persona, el registro, el enlace y los ids mencionables. Cada acción exige sesión, permiso, y que
  el token sea de **esa** persona y de **ese** registro. Sin `BETTER_AUTH_SECRET` solo se ve el hilo (sin formulario).
- Si el registro se elimina, llama `deleteCommentsFor(entity, id)` (de `contracts`) para limpiar su hilo.

## Qué expone
- **Tabla** (migración `0120_comments_init`): `comments`: `id`, `entity`, `entity_id`, `author_id`, `body`
  (1–2000), `created_at`. Sin llave foránea al registro ni al usuario (el historial sobrevive; la UI muestra
  «usuario eliminado»).
- **Permisos** (recurso `comment`): `create` (comentar y borrar lo propio) y `delete` (borrar lo de otros).
  owner y admin reciben ambos; member, `create`. **Ver** no es un permiso de este módulo: lo decide `canAccess`.
- **Sin rutas ni navegación propias.** Se usa incrustado.
- **Textos:** `messages.ts`, espacio `comments` en `es` y `en`.
- **Entidades que cubre (`covers`):** comentario, nota, observación / comment, note, observation.

## `contracts/`
- `contracts/comments.tsx`: `Comments` (componente de servidor, ver arriba) y los tipos `CommentsProps`, `CanAccess`.
- `contracts/index.ts` (servidor): `deleteCommentsFor(entity, entityId)`; puros: `findMentions`,
  `canDeleteComment`, `isEntityKey`, `isSafeHref`, `commentSchemas`, `COMMENT_MAX` y tipos.

## Menciones
- Se escribe `@Nombre Completo` (sin importar mayúsculas), con límite de palabra a ambos lados; el selector
  «Mencionar a alguien» inserta el texto. El servidor las detecta en el texto: **no confía** en lo que
  mande el cliente.
- Solo avisan a personas que **existen** (se leen de la base) **y** que `canAccess` aprobó al renderizar. Nunca
  a quien comenta. «@Ana María» no menciona también a «Ana».
- El aviso dice «<nombre> te mencionó en un comentario» y enlaza a `href`. **Nunca se expone ni se usa un
  correo**: la lista del cliente son solo nombres; la consulta solo lee `id` y `name`.
- Best-effort: si `notify()` falla se registra y el comentario queda. Idempotente por comentario y persona.
- El texto sale en el idioma de **quien comenta** (limitación de `notifications`).

## Garantías (y dónde viven)
- Nada se muestra ni se escribe sin `canAccess` + sesión + token válido de esa persona y ese registro.
- Borrar: toma la fila con `FOR UPDATE`, restringida a la entidad y el id del token, y aplica `canDeleteComment`.
- Entrada validada con Zod en el formulario y en la acción; solo Kysely, sin SQL concatenado.
- `href` del aviso solo puede ser una ruta relativa (`isSafeHref`).

## Variables de entorno
Ninguna propia. Usa `BETTER_AUTH_SECRET` (ya la tiene el template) para firmar el token.

## Instalar
1. Copiar la carpeta a `modules/comments/` (requiere `modules/notifications/`).
2. `pnpm modules:sync` y `pnpm db:migrate` (aplica `0120_comments_init` y corre el seed).
3. Incrustar `<Comments … canAccess={…} />` en la página del registro.

## Desinstalar
Sigue «Desinstalar» en `modules/README.md`: `pnpm tsx scripts/modules.ts can-remove comments`; revertir
`0120_comments_init` (borra la tabla con sus comentarios) **antes** de borrar la carpeta; quitar los
`<Comments>` de las páginas; borrar `modules/comments/` y `pnpm modules:sync`.

## Datos de ejemplo
`seed.ts`: dos comentarios sobre el registro inventado `demo` / `comments-seed-record`, a nombre del primer
usuario (ids fijos, idempotente; sin usuarios no hace nada).

## Límites conocidos (v0.1)
- Sin edición, respuestas anidadas, reacciones, adjuntos, formato, paginación (se ven los 200 más recientes).
- Menciones: solo hasta 40 personas por hilo (las primeras 100 por nombre que `canAccess` aprueba); dos
  personas con el **mismo nombre** son ambiguas y no se avisa a ninguna; no hay autocompletado al teclear `@`,
  solo el selector.
- Al renderizar, `canAccess` se llama una vez por candidato (hasta 100): debe ser barata. Un acceso concedido
  o revocado después de renderizar rige hasta que venza el token (2 h) para las menciones; el hilo mismo se
  vuelve a comprobar en cada render.
- Quien tiene un token vigente puede borrar lo suyo aunque le quiten `comment:create`; moderar exige
  `comment:delete` en vivo.
- Un solo ambiente y una sola organización, como el resto del template.

## Pruebas
`tests/comments.test.ts` (`node:test`, ejecutadas): reglas de borrado, detección de menciones (límites,
nombres largos, ambiguos, caracteres especiales), token (firma, vencimiento, manipulación), esquemas,
paridad `es`/`en`, permisos, manifiesto y, leyendo el código, guardas de acciones y del componente.
**Sin probar contra base ni en el navegador**: migración, consultas, seed, avisos reales y renderizado.

## Qué NO toca
Ningún ancla ni zona protegida. De otros módulos importa solo `@/modules/notifications/contracts` y
`@/modules/i18n/contracts*`.
