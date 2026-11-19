# events — Eventos de uso (v0.1)

> Contrato en texto plano. Un agente que usa este módulo lee SOLO este archivo y `manifest.json`.

## Qué hace
Registra eventos de uso de la app (alguien se registró, pagó, completó un paso) y los entrega al CRM de Fulvia por la llave de ingesta de la app, para que aparezcan en la línea de tiempo del contacto. Sin llave no hace nada, nunca bloquea ni rompe la acción de la persona, y solo envía propiedades de una lista blanca, sin datos personales por defecto.

## Qué expone
- **Rutas, tablas, permisos, navegación, textos:** ninguno. Es una función de servidor. No tiene interfaz, por eso no declara `messages`, y no modela entidades de negocio, por eso no declara `covers`.
- **`contracts/`** (solo servidor):
  - `track(name, props?, options?)`: envía y resuelve cuando termina el intento (máx. ~3 s). Nunca rechaza. Devuelve `{ ok: true, outcome: "created" | "duplicate" }` o `{ ok: false, reason }` con `reason` en `disabled` (sin llave o URL), `invalid_name`, `no_identity`, `too_large`, `rejected` (la ingesta respondió error) o `error` (red o tiempo agotado).
  - `trackAfter(name, props?, options?)`: igual, pero la entrega corre después de responder (`after` de Next); úsala cuando la persona está esperando.
  - Tipos `TrackOptions`, `TrackIdentity`, `TrackResult`, `EventProps` y `DEFAULT_ALLOWED_PROPS`, `isValidEventName`.

## Cómo se usa desde otro módulo
```ts
import { track, trackAfter } from "@/modules/events/contracts"

// En una Server Action, con sesión: el evento queda atado al id del usuario.
await trackAfter("order_paid", { amount: 19900, currency: "CLP", plan: "pro" })

// En un webhook o tarea (sin sesión) hay que decir de quién es:
await track("subscription_renewed", { plan: "pro" }, {
  identity: { userId: user.id },
  idempotencyKey: `renewal-${invoiceId}`,   // el mismo valor dos veces no duplica el evento
})
```
- **Nombre del evento:** minúsculas, empieza con letra, solo `a-z 0-9 _ . : -`, hasta 60. La ingesta da por clientes a quien emite `purchased`, `subscribed` o `became_customer`: úsalos solo cuando de verdad sea así.
- **A quién pertenece:** por defecto, el id del usuario con sesión (`external_user_id`). `identity.email` solo se envía si lo pasas tú; nunca se lee de las propiedades. Sin ninguna de las dos, no se envía nada (`no_identity`).
- **Propiedades:** solo estas claves pasan: `plan, amount, currency, status, source, channel, count, value, step, variant, entity, entity_id, path, locale, method, result, reason`. Más claves, con `allow: ["mi_clave"]` en las opciones. Valores: texto (máx. 200 caracteres), número finito, booleano o `null`; objetos y listas se descartan. Máximo 20 claves y 8 KB de JSON (el tope de la ingesta).
- **Datos personales:** se descartan, aunque estén en `allow`, las claves que los nombran (`email`, `phone`, `name`, `rut`, `address`, `token`, `password`…) y los valores que parecen un correo o un teléfono. Solo `allowPersonal: true` lo desactiva, y es decisión de quien lo llama (y de su política de privacidad).

## Variables de entorno
| Variable | |
|---|---|
| `ALLFLOW_INGEST_URL` | Base de la ingesta (`https://fulvia.app/api/ingest/v1`); se envía a `<base>/events`. Las mismas que usa el bloque de captura de lead de `landing`. |
| `ALLFLOW_INGEST_KEY` | Llave `afk_…` de la app (Bearer). Sin una de las dos, `track` no hace nada. |

## Datos de ejemplo
Sin tablas ni seed.

## Cuerpo que se envía
`POST <base>/events`, `Authorization: Bearer <llave>`, JSON: `kind`, `external_user_id` y/o `email`, `payload`, `idempotency_key` (si se dio) y `source` (`"app"` por defecto). Nunca `org_id`, `project_id`, `stage` ni `contact_id`: la ingesta los rechaza con 400. La ingesta crea el contacto si el evento llega antes que cualquier formulario.

## Instalar
1. Copiar la carpeta a `modules/events/`.
2. `pnpm modules:sync` (deja las `env` comentadas en `.env.example`).
3. Completar `ALLFLOW_INGEST_URL` y `ALLFLOW_INGEST_KEY` en `.env.local` (la saga ya las fija en apps generadas). Sin `pnpm install` ni migraciones.

## Desinstalar
Sin tablas: `pnpm tsx scripts/modules.ts can-remove events`, borrar `modules/events/` y `pnpm modules:sync`. Antes, quitar las llamadas a `track`.

## Límites conocidos
- Mejor esfuerzo: no hay cola ni reintentos; un evento que falla (red, 5xx, límite de 120 por minuto por llave de la ingesta) se pierde y solo deja una línea de aviso en el log, sin la llave.
- Nada se registra solo (ni vistas de página): cada `track` lo escribe quien construye la app.
- La ingesta guarda el evento por contacto; los eventos de personas sin sesión y sin `identity` no se envían.
- La detección de datos personales en valores es una red de seguridad (correos y números largos), no una garantía: la lista blanca es la defensa real.

## Pruebas
`tests/events.test.ts`, sin red: forma del cuerpo, lista blanca, filtro de datos personales, no-op sin llave, errores HTTP y de red, tiempo agotado, manifiesto. Sin probar: la entrega real contra la ingesta, y `trackAfter` dentro de una petición de Next.

## Qué NO toca
Ningún archivo ancla ni zona protegida.
