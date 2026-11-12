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
- **Tablas:** `payments` (orden, proveedor, monto en unidad menor, moneda, estado, `environment`), `payments_events` (un registro por evento; `unique (provider, event_id)` es el candado de idempotencia), `payments_subscriptions`.
- **Permisos / navegación:** ninguno. Es un módulo de servidor.
- **`contracts/`:** `startCheckout`, `getPaymentByOrder`, `cancelPayment`, `syncPayment`, `refundPayment`, `startSubscription`, `getSubscription`, los tipos (`PaymentProvider`, `PaymentEvent`…), los errores y `minorToMajor` / `majorToMinor`.

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

## Garantías (y la prueba de cada una: `tests/`)
- **PAY-3** Una notificación que no se autentica responde 401 y no escribe nada. Sin secreto configurado, rechaza.
- **PAY-2** El mismo evento procesado N veces deja un solo cambio (candado `(provider, event_id)` en la misma transacción que el cambio de estado).
- **PAY-5** El monto de la orden se guarda al crear el checkout; el del webhook solo se compara. Si no cuadra, `needs_review`.
- **PAY-4** Ningún log lleva cuerpos, cabeceras, llaves ni mensajes de error del proveedor (`server/log.ts` es una lista blanca).
- **PAY-6** Cambiar de proveedor es cambiar `PAYMENTS_PROVIDER` (o el argumento): el código de la app no cambia.
- **Una orden, un pago activo:** índice único parcial; dos `startCheckout` simultáneos terminan con un solo pago.
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

## Límites conocidos
- Un evento de suscripción tardío puede llegar fuera de orden: `canceled` es terminal y el resto se aplica en el orden de llegada.
- `refundPayment` no cambia el estado: lo cambia el reembolso confirmado (webhook o `syncPayment`).
- La pantalla de administración de pagos no existe todavía.

## Datos de ejemplo
Ninguno (`seed` no existe): vacío no hay pagos.

## Instalar
1. Copiar la carpeta a `modules/payments/`.
2. `pnpm modules:sync` (registra la migración 0101 y escribe el shim `app/api/payments/webhook/[provider]/route.ts`).
3. Agregar las `env` del manifiesto a `.env.local` y a Vercel.
4. `pnpm db:migrate`.

## Desinstalar
1. Revertir la migración 0101 antes de borrar la carpeta (`down`, y borrar su fila de `kysely_migration`).
2. Borrar `modules/payments/`.
3. `pnpm modules:sync`.

## Qué NO toca
Ningún archivo ancla ni zona protegida. (El contrato sí se extendió una vez para aceptar `route.ts` como ruta; ver `modules/README.md`.)
