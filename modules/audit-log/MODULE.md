# audit-log — Registro de auditoría

> Lee solo este archivo y `manifest.json` para instalarlo, usarlo o quitarlo.

## Qué hace
Guarda quién cambió qué y cuándo: cada fila es un evento (persona, acción, entidad, id del registro y un
**diff** campo por campo). Es de **solo inserción**: un trigger rechaza todo `UPDATE` y `DELETE`. Antes de
guardar, **redacta** los campos sensibles (contraseñas, tokens, llaves…) por nombre de campo. La pantalla
`/admin/audit` lista el registro, lo más nuevo primero, con filtros.

## Qué expone
- **Ruta:** `/admin/audit` (sesión + onboarding + permiso `audit:read`; si no, 403).
  Filtros por GET: `entity`, `action` (prefijo, p. ej. `contact.`), `actor` (id o parte del nombre), `from`,
  `to` (días, UTC, `to` inclusivo) y `cursor` («Ver más antiguos», 50 por página).
- **Tabla** (migración `0109_audit_log_init`): `audit_log`: `id`, `actor_id?` (nulo = sistema; **sin llave
  foránea**, el historial sobrevive al usuario), `actor_name?` (nombre al momento de registrar), `action`,
  `entity`, `entity_id` (sin llave foránea), `diff` jsonb, `created_at`. El trigger solo deja borrar filas
  cuyo id empieza con `seed-` (los datos de ejemplo); las reales no se tocan.
- **Permisos:** recurso `audit` con `read`. owner y admin lo reciben; member nada. Escribir no es permiso:
  `recordAudit()` lo llama código de servidor de confianza. `audit:read` es además `adminAccess`: abre la
  puerta de `/admin` a quien lo tenga por un rol propio, sin ser admin.
- **Navegación:** «Auditoría» → `/admin/audit` (`area: "admin"`, visible con `audit:read`). Sin cabecera.
- **Textos:** `messages.ts`, espacio `audit-log` en `es` y `en`.
- **Entidades que cubre (`covers`):** auditoría / audit, registro de auditoría / audit log, bitácora,
  historial de cambios / change log.

## `contracts/` (lo único importable por otro módulo)
```ts
import { recordAudit, recordAuditIn, audited, buildDiff, redact } from "@/modules/audit-log/contracts"

// Como el usuario de la sesión (necesita contexto de request).
await recordAudit({ action: "contact.update", entity: "contact", entityId: id, before, after })
// Trabajos y webhooks: actor explícito o "system".
await recordAudit({ action: "invoice.sync", entity: "invoice", entityId: id, actor: "system", after: row })
// Dentro de TU transacción (se confirma o se revierte con el cambio); exige actor explícito.
await recordAuditIn(trx, { action: "deal.update", entity: "deal", entityId: id, actor: { id: userId, name }, before, after })

// Envoltorio de acciones de servidor: registra DESPUÉS de que la función tiene éxito.
export const updateContact = audited(
  { action: "contact.update", entity: "contact", entityId: ([id]) => id,
    before: ([id]) => getContact(id), after: ([id]) => getContact(id), sensitive: ["rut"] },
  async (id: string, patch: Patch) => { /* … */ }
)
```
- `action` y `entity` son claves en minúscula (`contact.update`, `purchase_order`). `entityId` es texto (≤200).
- Sin `before` → creación (cada campo con solo `to`); sin `after` → eliminación (solo `from`); con ambos,
  solo los campos que cambiaron. También se acepta un `diff` ya armado (`{ campo: { from?, to? } }`).
- `audited`: si la función falla, no registra nada. Si falla el registro, se escribe en consola y la
  llamada devuelve igual (`strict: true` lo convierte en error). Si `before` lanza, la función no corre.
  Como la acción de servidor ya hizo su trabajo, `audited` va **dentro** de un archivo `"use server"` que
  ya comprueba sesión y permiso: no autoriza nada.
- Errores (`AuditError.code`): `unauthenticated` (sin sesión ni actor explícito), `invalid_input`.
- Puros: `buildDiff`, `redact`, `isSensitiveKey`, `REDACTED`, `auditEntrySchema`.

## Redacción
Por nombre de campo, en cualquier profundidad: contiene `password`, `passwd`, `secret`, `token`, `apikey`,
`accesskey`, `authorization`, `cookie`, `credential`, `privatekey`, `cardnumber`, `sessionid`, o es
exactamente `pin`, `otp`, `cvv`, `cvc`, `ssn`, `pass`, `pwd`, `iban` (se ignoran mayúsculas y separadores).
`sensitive: [...]` suma nombres propios (p. ej. `rut`). El cambio se detecta sobre el valor real, así que una
contraseña cambiada aparece como `{ from: "[redacted]", to: "[redacted]" }` y una igual no aparece. Además:
fechas a ISO, bigint a texto, textos a 500 caracteres, profundidad 6, 50 elementos por lista y un tope de
32 KB por diff (si lo pasa, queda un solo campo `_truncated`).
**La redacción es por nombre**: un secreto dentro de un texto libre o en un campo con otro nombre no se detecta.

## Variables de entorno
Ninguna. Sin dependencias de otros módulos ni paquetes nuevos.

## Datos de ejemplo
`seed.ts` inserta 5 eventos inventados (ids `seed-audit-0001…`, idempotente). Sin ellos la pantalla
muestra «Todavía no hay nada registrado».

## Instalar
1. Copiar la carpeta a `modules/audit-log/`.
2. `pnpm modules:sync` (registros y el shim de `/admin/audit`).
3. `pnpm db:migrate` (aplica `0109_audit_log_init` y corre el seed).
4. Llamar a `recordAudit` / `audited` desde las acciones que importen.

## Desinstalar
Sigue «Desinstalar» de `modules/README.md`: `can-remove audit-log`, respaldar (`pg_dump -t audit_log`: el
`down` borra el historial), revertir `0109_audit_log_init`, borrar la carpeta y `pnpm modules:sync`.

## Límites conocidos (v0.1)
- No hay retención ni purga: el trigger impide borrar; limpiar el historial exige desactivarlo a mano.
- No guarda IP ni agente de usuario (a propósito: datos personales).
- Sin exportación, sin búsqueda de texto libre, sin vista de detalle por registro; el filtro de acción es por prefijo.
- Quien llama decide qué registrar: no hay captura automática de cambios en la base.
- `recordAudit` por defecto no sirve sin request (usa la sesión); en jobs pasar `actor`.
- Requiere un template con el contrato `adminAccess` (puerta de `/admin` por permiso): en uno anterior, el layout de `/admin` sigue dejando fuera a quien no sea admin.
- Los nombres de actor son una foto al registrar; no se actualizan si la persona cambia de nombre.

## Pruebas
`tests/audit-log.test.ts` (`node:test`, 19 pruebas): llaves sensibles, redacción anidada, diffs
(creación/edición/eliminación/igualdad/tope), esquema de entrada, actor, grabación con una base falsa,
`audited` (éxito, fallo, estricto), filtros y cursores, paridad `es`/`en`, permisos y, leyendo el código,
guardas y solo-inserción. Corridas: 19/19 transpilado con `tsc` + `node --test`. **Sin probar contra base**:
migración, trigger, índices, consultas (cursor con `(created_at, id) < (…)`), la página ni su render.

## Qué NO toca
Ningún ancla ni zona protegida. De otros módulos importa solo `@/modules/i18n/contracts*`.
