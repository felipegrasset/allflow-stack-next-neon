# payments — Pagos (overlay de la feature `billing`)

> Contrato en texto plano. Un agente que instala o usa este módulo lee SOLO este
> archivo y `manifest.json`.

## Qué hace
Cobra con un proveedor intercambiable (Mercado Pago, Flow, Paddle) detrás de una
sola interfaz, `PaymentProvider`. Guarda cada pago, recibe los webhooks
**autenticados** y los aplica **una sola vez**. La app nunca ve una tarjeta: la
persona paga en el checkout alojado del proveedor. Es el overlay de la feature
`billing` que el router de stack ya detecta (un solo nombre: la feature se
llama `billing`, el módulo `payments`).

## Qué expone
- **Rutas:** `POST /api/payments/webhook/[provider]` (pública; autentica el proveedor).
- **Tablas:** `payments` (orden, proveedor, monto en unidad menor, moneda, estado, `environment`), `payments_events` (un registro por evento; `unique (provider, event_id)` es el candado de idempotencia), `payments_subscriptions` (con `cancel_at` y `last_event_at` desde 0124), `payments_refund_requests` (0124: cada reembolso pedido al proveedor y el monto que reserva).
- **Permisos / navegación:** ninguno. Es un módulo de servidor.
- **`contracts/` (pagos):** `startCheckout`, `getPaymentByOrder`, `cancelPayment`, `syncPayment`, `refundPayment`, `startSubscription`, `getSubscription`, `listPayments` y `getPayment` (solo lectura: lo que la base ya tiene, sin consultar al proveedor; lista paginada por cursor, con filtros de estado, proveedor y ambiente, máximo 100 por página), los tipos (`PaymentProvider`, `PaymentEvent`…), los errores y `minorToMajor` / `majorToMinor`.
- **`contracts/` (suscripciones, 0.2):**
  - `getActiveSubscription(subscriberRef): Promise<SubscriptionRecord | null>` — la que da derecho HOY. **Úsala para «¿qué plan tiene?».**
  - `listSubscriptions(subscriberRef): Promise<SubscriptionRecord[]>` — todas, más nueva primero (`created_at desc, id desc`), máximo 100.
  - `getSubscription(subscriberRef)` — SIN CAMBIOS: la fila cruda (snake_case) más reciente en cualquier estado. Una `pending` nueva (checkout abierto y no pagado) tapa a la `active`: no la uses para decidir acceso; queda por compatibilidad.
  - `cancelSubscription(target: { subscriptionId } | { subscriberRef }, { atPeriodEnd: boolean }): Promise<CancelSubscriptionResult>` (`subscriptionId` = id local).
  - `changeSubscriptionPlan(subscriberRef, newPlanRef): Promise<ChangeSubscriptionPlanResult>`.
  - Puras: `subscriptionEntitles(sub, now)`, `pickActiveSubscription(subs, now)`, `compareSubscriptions(a, b)`.
  - Tipos: `SubscriptionRecord` (`id, provider, externalId, subscriberRef, planRef, status, currentPeriodEnd, cancelAt, createdAt, updatedAt`), `SUBSCRIPTION_STATUSES` / `SubscriptionStatus`, `CancelSubscriptionTarget`, `CancelSubscriptionResult` (`subscriptionId, externalId, provider, atPeriodEnd`), `ProviderPlanChange` (`{ mode: "in_place"; billing: "prorated_immediately" }`), `ChangeSubscriptionPlanResult` (`ProviderPlanChange & { subscriptionId, externalId, provider, newPlanRef }`).
  - Errores: `OperationNotSupportedError` (`provider`, `operation`), `RefundInProgressError` (`paymentId`, `availableMinor`), `SubscriptionChangeError` (`code`: `not_found` | `not_active` | `already_canceled` | `same_plan`).

## Cómo se cobra (desde código de servidor)
```ts
import { startCheckout } from "@/modules/payments/contracts"

const { url } = await startCheckout({
  orderId: order.id,
  amountMinor: order.totalMinor, // SALE DE TU ORDEN en el servidor, nunca del navegador
  currency: "CLP",
  description: `Pedido ${order.id}`,
  returnPath: `/orders/${order.id}`,
})
redirect(url)
```
Al volver, la página de retorno llama `syncPayment(paymentId, searchParams.payment_id)`
para no esperar al webhook (y porque el sandbox de Mercado Pago no envía webhooks).
La app cumple el pedido cuando `getPaymentByOrder(id)?.status === "approved"`.

## Estados
`pending` → `approved` → `refunded`. `failed` no es terminal (el proveedor deja
reintentar). `canceled` lo pone la app y libera la orden. `needs_review` es plata
que no cuadra (monto distinto, pago sobre un checkout cancelado, un segundo pago
aprobado para la misma orden, reembolso sin pago): **no cumplas el pedido** y que
lo mire una persona.

## Suscripciones

**Regla de vigencia** (`contracts/subscriptions.ts`, la misma que `plans.subscriptionGrants`):
da derecho una suscripción `active`, o `past_due` / `canceled` con `current_period_end`
estrictamente futuro. `pending` nunca. Si varias dan derecho: `active` antes que
`past_due` antes que `canceled`; después la de `created_at` más nuevo; después el `id` mayor.

**Cancelar y cambiar de plan solo PIDEN.** Igual que el reembolso, el estado local no
cambia por la llamada: cambia cuando el proveedor lo confirma por webhook. Hasta entonces
`getActiveSubscription` sigue mostrando lo anterior.
- `cancelSubscription` actúa sobre la suscripción `active` o `past_due` (por persona: la de mejor rango).
  `atPeriodEnd: true` mantiene lo pagado hasta el fin del período (el proveedor confirma con la
  fecha en `cancelAt` y, al llegar, `canceled`); `false` cancela ya, **sin devolver** la parte no usada.
- `changeSubscriptionPlan` exige una suscripción `active` y un plan distinto. **Solo Paddle**:
  `PATCH /subscriptions/{id}` con `proration_billing_mode: prorated_immediately`, es decir, Paddle
  prorratea la diferencia del resto del período y **la cobra en ese momento** (en una baja de plan
  deja crédito). Si el cobro falla, Paddle no aplica el cambio. Paddle rechaza cambios en
  `past_due` y cuando faltan menos de 30 minutos para el próximo cobro. El adaptador también
  rechaza suscripciones con más de un ítem. Llega como `subscription.updated` con el plan nuevo.
- **Mercado Pago y Flow no soportan cancelar ni cambiar de plan** (`OperationNotSupportedError`):
  sus adaptadores no crean suscripciones (preapproval / `subscription/create`) ni leen sus webhooks,
  así que no habría estado local que confirmar.
- Un proveedor sin la operación lanza `OperationNotSupportedError`, nunca un éxito fingido.
- **Cambio de comportamiento (0.2, Paddle):** en `subscription.canceled` el fin de lo pagado es
  `canceled_at`. Una cancelación inmediata corta el acceso al momento; antes se mantenía hasta el
  fin del período anterior. Además se lee `subscription.updated` (antes se ignoraba): estado según la
  entidad (`trialing` = active, `paused` no genera evento), plan nuevo, fin de período y
  cancelación programada.
- Un evento de suscripción más viejo (`occurredAt`) que el último aplicado no cambia nada: un
  aviso atrasado no revierte un cambio de plan.

## Garantías (y la prueba de cada una: `tests/`)
- **PAY-3** Una notificación que no se autentica responde 401 y no escribe nada. Sin secreto configurado, rechaza.
- **PAY-2** El mismo evento procesado N veces deja un solo cambio (candado `(provider, event_id)` en la misma transacción que el cambio de estado).
- **PAY-5** El monto de la orden se guarda al crear el checkout; el del webhook solo se compara. Si no cuadra, `needs_review`.
- **PAY-4** Ningún log lleva cuerpos, cabeceras, llaves ni mensajes de error del proveedor (`server/log.ts` es una lista blanca).
- **PAY-6** Cambiar de proveedor es cambiar `PAYMENTS_PROVIDER` (o el argumento): el código de la app no cambia.
- **Una orden, un pago activo:** índice único parcial; dos `startCheckout` simultáneos terminan con un solo pago.
- **PAY-7 Sin doble reembolso.** Antes de llamar al proveedor, `refundPayment` reserva el monto en `payments_refund_requests` dentro de la MISMA transacción que bloquea la fila del pago (`for update`). Un segundo pedido concurrente que no quepa en lo que queda libre lanza `RefundInProgressError` sin llamar al proveedor; un reembolso total con otro pedido abierto, también. La reserva se libera cuando el proveedor confirma (`refunded_minor` llega al total esperado del pedido) o cuando la llamada falló sin duda (4xx, o un error previo al envío); si el resultado es incierto (timeout, 5xx) queda tomada. Mercado Pago recibe el id del pedido como `X-Idempotency-Key`. Pruebas: «PAY-7: dos refundPayment CONCURRENTES por el mismo monto pendiente…» y «PAY-7: la confirmación libera la reserva…» (`payments-db.test.ts`), y la aritmética en `payments-v02.test.ts` («doble reembolso: el segundo pedido…»).
- **Una suscripción pendiente no tapa la vigente.** Pruebas: «el bug: una pending más nueva NO tapa a la active» (`payments-v02.test.ts`) y «getActiveSubscription: un checkout nuevo sin pagar NO tapa a la activa» (`payments-db.test.ts`).
- **Cancelar/cambiar plan no cambian el estado local.** Prueba: «cancelSubscription y changeSubscriptionPlan solo PIDEN…» (`payments-db.test.ts`).
- **No existe ruta para «simular un pago».** Las pruebas llaman a `applyEvent` con eventos normalizados; en producción solo entra lo que un proveedor autentica.

## Variables de entorno
Ver `env` en `manifest.json`. Las llaves llegan como variables de entorno de la
app (Vercel): las de Fulvia o las del cliente (BYOK) son las mismas variables
con otros valores. `PAYMENTS_ENV` es `sandbox` salvo que diga `production`.

## Escribir un proveedor
Un archivo en `providers/<id>.ts` que exporta `createProvider(env)` y devuelve
un `PaymentProvider` (o `null` si faltan todas sus variables; si faltan solo
algunas, `readProviderEnv` lanza). Reglas: `parseWebhook` autentica **antes** de
devolver nada y lanza `WebhookAuthError` si no puede; los montos entran y salen
en unidad menor (`majorToMinor`); un error de la API del proveedor se lanza como
`ProviderApiError` (solo el estado, nunca el cuerpo); `eventId` debe ser estable
entre reintentos del proveedor. Para Flow y Mercado Pago, donde el aviso solo
trae un id, el estado se confirma con la API dentro de `parseWebhook`.

Operaciones opcionales: `refund(id, amountMinor?, { idempotencyKey })`,
`createSubscription`, `cancelSubscription(externalId, { atPeriodEnd })` (sin
opciones: al fin del período) y `changeSubscriptionPlan(externalId, newPlanRef)`.
Si no las implementas, el núcleo responde `OperationNotSupportedError`.

**Regla del reembolso:** si `refund` lanza algo que NO es `ProviderApiError`, o un
`ProviderApiError` 4xx, el núcleo entiende que **no se reembolsó nada** y libera la
reserva. Por eso las validaciones locales van antes de cualquier llamada que mueva
plata, y todo error de red o de la API sale como `ProviderApiError` con su estado (0 si
no hubo respuesta). Envía `idempotencyKey` al proveedor si su API la acepta.

## Límites conocidos
- Un evento de suscripción sin `occurredAt` se aplica en el orden de llegada; `canceled` es terminal.
- `refundPayment` no cambia el estado: lo cambia el reembolso confirmado (webhook o `syncPayment`).
- Un pedido de reembolso con resultado incierto (`unknown`), o uno que quedó `requested` porque el proceso cayó entre la reserva y la llamada, bloquea ese monto hasta que el proveedor confirme. No hay función para liberarlo a mano: si el reembolso no ocurrió, hay que marcar la fila `failed` en la base.
- Paddle no documenta claves de idempotencia; Flow usa su `refundCommerceOrder` determinista (dos reembolsos parciales del mismo monto sobre un pago no son posibles en Flow).
- En Paddle, `startSubscription` guarda una fila `pending` con el id de la transacción; la suscripción real llega con otro id (`sub_…`) y esa fila `pending` nunca se cierra. `getActiveSubscription` la ignora; `getSubscription` no.
- Una suscripción `paused` de Paddle no se refleja (no genera evento).
- Ningún proveedor usa el modo «cancelar al fin del período + suscripción nueva» para cambiar de plan, y no está modelado.
- La migración 0124 crea los índices sin `concurrently`: en una tabla `payments` grande bloquea escrituras mientras se construyen.
- La pantalla de administración vive en otro módulo, `payments-admin`.
- `listPayments`, `getPayment`, el candado de reembolso y las suscripciones 0.2 tienen pruebas contra Postgres escritas pero no ejecutadas en esta máquina.

## Datos de ejemplo
Ninguno (`seed` no existe): vacío no hay pagos.

## Instalar
1. Copiar la carpeta a `modules/payments/`.
2. `pnpm modules:sync` (registra las migraciones 0101 y 0124 y escribe el shim `app/api/payments/webhook/[provider]/route.ts`).
3. Agregar las `env` del manifiesto a `.env.local` y a Vercel.
4. `pnpm db:migrate`.

## Desinstalar
1. Revertir las migraciones antes de borrar la carpeta, de la más nueva a la más vieja: `0124_payments_refund_guard` y luego `0101_payments_init` (`down`, y borrar sus filas de `kysely_migration`). Para volver a la 0.1 basta revertir 0124 (pierde los pedidos de reembolso y la cancelación programada).
2. Borrar `modules/payments/`.
3. `pnpm modules:sync`.

## Qué NO toca
Ningún archivo ancla ni zona protegida. (El contrato sí se extendió una vez para aceptar `route.ts` como ruta; ver `modules/README.md`.)
