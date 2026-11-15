# payments-admin — Administración de pagos

> Contrato en texto plano. Un agente que instala o usa este módulo lee SOLO este
> archivo y `manifest.json`.

## Qué hace
La pantalla de administración del módulo `payments` y la página a la que vuelve
la persona después de pagar. No tiene tablas ni migraciones: todo lo que lee o
pide pasa por `@/modules/payments/contracts` (nunca por sus tablas).

- **`/admin/payments`** (permiso `payment:read`): primero la cola
  de `needs_review` (hasta 10, con enlace a todos); luego la búsqueda por orden
  (`?order=<id>` lleva al detalle de su pago) y la tabla de todos los pagos, del
  más nuevo al más antiguo, con filtros por estado, proveedor y ambiente en la
  URL y paginación por cursor (`listPayments`). Un cursor inválido vuelve a la
  primera página con un aviso.
- **`/admin/payments/[id]`** (`payment:read`): el detalle de un pago
  (`getPayment`, lo que tiene la base): estado, proveedor, ambiente, monto,
  reembolsado, disponible, fechas e ids. Si está en `needs_review`, lo destaca y
  dice que no se entregue el pedido.
- **Consultar al proveedor** (`payment:read`): llama `syncPayment`, que pregunta
  al proveedor con la llave del servidor y aplica lo que él responde.
- **Reembolsar** (`payment:refund`): monto opcional (vacío = todo lo
  disponible), diálogo de confirmación que nombra el monto y la orden, y
  `refundPayment`. El estado cambia cuando el proveedor confirma (webhook o
  «Consultar al proveedor»), no al pedirlo.
- **`/pago/retorno`** (pública): concilia el pago con `syncPayment` y dice en una
  frase cómo salió. No muestra montos, ids ni motivos. No cumple pedidos.

## Qué expone
- **Rutas:** `/admin/payments` y `/admin/payments/[id]` (grupo `app`, bajo el
  layout de `/admin`) y `/pago/retorno` (grupo `marketing`, pública).
- **Permisos:** `payment: ["read", "refund"]`. `owner` y `admin` los tienen
  por defecto; `member`, ninguno. `payment:read` es además `adminAccess`: abre la
  puerta de `/admin` a quien lo tenga por un rol propio. Cada página y acción
  revisa sesión + onboarding **y** su permiso con `auth.api.hasPermission`
  (roles estáticos y dinámicos); ya no exige ser admin: ver pide `payment:read`
  y reembolsar pide `payment:refund`, así un rol propio puede ver sin reembolsar.
- **Navegación:** «Pagos» → `/admin/payments` (`area: "admin"`, visible con `payment:read`).
- **Textos:** `messages.ts` (`payments-admin.*`, `es` y `en`).
- **`contracts/`:** `paymentReturnPath(orderId, next?)`, `paymentAdminHref(orderId)`,
  `paymentDetailHref(paymentId)`,
  `PAYMENTS_ADMIN_PATH`, `PAYMENT_RETURN_PATH`. Puras.
- **Entidades que cubre:** ninguna (no tiene tablas).

## Cómo se usa desde la app u otro módulo
```ts
import { startCheckout } from "@/modules/payments/contracts"
import { paymentReturnPath } from "@/modules/payments-admin/contracts"

const { url } = await startCheckout({
  orderId: order.id,
  amountMinor: order.totalMinor, // de TU orden, en el servidor
  currency: "CLP",
  description: `Pedido ${order.id}`,
  returnPath: paymentReturnPath(order.id, `/orders/${order.id}`),
})
redirect(url)
```
La persona vuelve a `/pago/retorno?order=…&next=…`, que concilia y ofrece
«Continuar» hacia `next` (solo rutas internas; otra cosa cae en `/`). La app
cumple el pedido en su propio servidor cuando
`getPaymentByOrder(id)?.status === "approved"`, nunca porque se vio esta página.

## Garantías (y su prueba: `tests/payments-admin.test.ts`)
- **No hay ruta ni acción para aprobar o «simular» un pago.** El módulo no llama
  `applyEvent` ni toca tablas; la prueba lo revisa en todos sus archivos.
- **El reembolso se decide con lo que lee el servidor** (`getPayment`), no con
  lo que manda el navegador: el pago debe existir, estar `approved`, y su reembolsado debe ser el que vio la persona (si cambió, la
  página está vieja y se rechaza). Monto entero en unidad menor, > 0 y ≤ lo
  disponible. `refundPayment` vuelve a revisar todo eso.
- **Montos sin coma flotante ni adivinanzas:** el monto escrito se parsea con
  aritmética de texto; se rechazan separadores de miles (en es-CL «1.990» son
  mil novecientos noventa; en en-US, 1,99) y más decimales de los que tiene la
  moneda.
- **Logs (PAY-4):** lista blanca (`server/log.ts`): acción, resultado, id del
  pago, id de quien actúa, monto, y de un error solo su `name`. Nunca cuerpos,
  cabeceras, correos, datos de tarjeta ni mensajes del proveedor. La pantalla
  tampoco los muestra (el `PaymentRecord` no los trae).
- **Retorno sin redirección abierta**, y la referencia del proveedor que llega
  en la URL solo se usa para preguntarle al proveedor (`syncPayment` rechaza
  una que no sea de ese pago; entonces se reintenta con la guardada).

## Límites conocidos
- **Paginación solo hacia adelante** («Siguientes» y «Volver al inicio»): el
  cursor de `listPayments` no permite volver una página. Sin conteo total.
- La cola muestra hasta 10 pagos `needs_review` sin aplicar los filtros de la
  tabla; «Ver todos» filtra la tabla por ese estado.
- Con muchos pagos, la lista se beneficia del índice que `payments` documenta
  (`created_at desc, id desc`); no existe todavía.
- **Un reembolso pedido no se ve hasta que el proveedor lo confirma.** La defensa
  contra el doble reembolso es `payments` (PAY-7: reserva el monto en la misma
  transacción que bloquea el pago): un segundo pedido que no quepa en lo libre
  lanza `RefundInProgressError` y la pantalla muestra «este pago ya tiene un
  reembolso en curso» (código `in_progress`) sin llamar al proveedor. Esta
  pantalla además bloquea el segundo pedido en la misma vista. La reserva de un
  resultado incierto (timeout, 5xx) sigue tomada hasta que el proveedor
  confirme y **no hay botón para liberarla**: el mensaje manda a «Consultar al
  proveedor»; si el reembolso nunca ocurrió, se corrige en la base (ver
  `payments`).
- **`/pago/retorno` es pública.** Cada visita a un pago no liquidado consulta al
  proveedor, así que antes se limita con `consume()` de `@/server/rate-limit`
  (10 por minuto por IP y pago, y 30 por minuto por IP en total). Pasado el
  límite, o si el limitador falla, la página muestra el estado que ya tiene la
  base y NO consulta al proveedor (el webhook o la siguiente visita lo
  concilian). La búsqueda de una orden que no existe solo lee la base y no
  cuenta. Quien adivine un id de orden aún ve si está pagada o no: usa ids de
  orden no correlativos. La IP sale de `x-forwarded-for` (sirve detrás de
  Vercel; con otro proxy, revisar).
- **Flow vuelve por POST** con el `token` en el cuerpo; la página no lo lee y
  concilia con la referencia guardada (por eso `paymentReturnPath` pone `order`
  en la URL). Que Next 16 sirva la página ante un POST sin Server Action no se
  probó.
- Solo pagos únicos: las suscripciones de `payments` no se muestran.
- El formulario de reembolso es un campo con estado propio, no React Hook Form;
  cumple las reglas de accesibilidad de `CONVENTIONS.md`.
- Las suscripciones de `payments` 0.2 (`getActiveSubscription`, cancelar, cambiar de plan) no tienen pantalla aquí.
- El cuerpo de `hasPermission` se castea: su tipo se infiere de los permisos
  generados y `payment` solo existe ahí después de `pnpm modules:sync`.

## Sin probar
Las pruebas de `tests/` son de lógica pura y corren con `node --test` (lógica pura,
más las comprobaciones de código). No se probó: las páginas renderizadas, la paginación contra una base, las Server Actions contra una
base y un proveedor de prueba, `hasPermission` con roles dinámicos, el limitador contra Postgres, ni e2e/axe.

## Variables de entorno
Ninguna propia (las de `payments`).

## Datos de ejemplo
Ninguno (sin `seed`).

## Instalar
1. Tener instalado `payments` (0.2 o posterior, con `RefundInProgressError`, migración 0124) y un template con el contrato `adminAccess`.
2. Copiar la carpeta a `modules/payments-admin/`.
3. `pnpm modules:sync` (registra permisos, navegación, textos y tres shims:
   `app/(app)/admin/payments/page.tsx`, `app/(app)/admin/payments/[id]/page.tsx`
   y `app/(marketing)/pago/retorno/page.tsx`).
4. `pnpm modules:check && pnpm typecheck`.

## Desinstalar
Sin migraciones: verificar con `pnpm tsx scripts/modules.ts can-remove payments-admin`,
borrar la carpeta y `pnpm modules:sync`. Las apps que usaban `paymentReturnPath`
deben cambiar su `returnPath`.

## Qué NO toca
Ningún archivo fuera de su carpeta, ningún ancla ni zona protegida, ni el
módulo `payments`.
