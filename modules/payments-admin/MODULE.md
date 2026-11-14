# payments-admin — Administración de pagos

> Contrato en texto plano. Un agente que instala o usa este módulo lee SOLO este
> archivo y `manifest.json`.

## Qué hace
La pantalla de administración del módulo `payments` y la página a la que vuelve
la persona después de pagar. No tiene tablas ni migraciones: todo lo que lee o
pide pasa por `@/modules/payments/contracts` (nunca por sus tablas).

- **`/admin/payments?order=<id>`** (solo admins, permiso `payment:read`): busca
  el pago de una orden y muestra su detalle (estado, proveedor, ambiente, monto,
  reembolsado, disponible, fechas, ids). Si está en `needs_review`, lo destaca y
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
- **Rutas:** `/admin/payments` (grupo `app`, bajo el layout de `/admin`) y
  `/pago/retorno` (grupo `marketing`, pública).
- **Permisos:** `payment: ["read", "refund"]`. `owner` y `admin` los tienen
  por defecto; `member`, ninguno. Cada página y acción revisa sesión de admin
  (`requireAdmin`) **y** el permiso con `auth.api.hasPermission` (roles
  estáticos y dinámicos), así un rol propio puede ver sin reembolsar.
- **Navegación:** «Pagos» → `/admin/payments` (`adminOnly`).
- **Textos:** `messages.ts` (`payments-admin.*`, `es` y `en`).
- **`contracts/`:** `paymentReturnPath(orderId, next?)`, `paymentAdminHref(orderId)`,
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
- **El reembolso se decide con lo que lee el servidor**, no con lo que manda el
  navegador: el pago vigente de la orden debe ser el mismo `paymentId`, estar
  `approved`, y su reembolsado debe ser el que vio la persona (si cambió, la
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
- **No hay lista de pagos, filtros ni cola de `needs_review`.**
  `payments/contracts` no expone una función para listar (ni para leer un pago
  por id sin llamar al proveedor), y este módulo no lee sus tablas. v0.1 busca
  **por orden** (`getPaymentByOrder`: el pago activo, o el último). La ruta
  `/admin/payments/[id]` de la especificación tampoco existe por lo mismo: el
  detalle va en `/admin/payments?order=`. Cuando `payments` agregue
  `listPayments({ status?, provider?, environment?, cursor, limit })` y
  `getPayment(paymentId)`, se suman aquí la tabla con filtros, la cola y el
  detalle por id.
- **Un reembolso pedido no se ve hasta que el proveedor lo confirma.** En esa
  ventana, otro admin (u otra pestaña) podría pedir un segundo reembolso: la
  pantalla bloquea el segundo pedido solo en la misma vista. Flow rechaza un
  reembolso repetido del mismo monto; Mercado Pago y Paddle, sin verificar. La
  defensa real necesita una clave de idempotencia o un «reembolso en curso»
  dentro de `payments`.
- **`/pago/retorno` es pública** y cada visita a un pago no liquidado consulta al
  proveedor. No tiene rate limit propio. Muestra solo una frase, pero quien
  adivine un id de orden ve si está pagada o no: usa ids de orden no
  correlativos.
- **Flow vuelve por POST** con el `token` en el cuerpo; la página no lo lee y
  concilia con la referencia guardada (por eso `paymentReturnPath` pone `order`
  en la URL). Que Next 16 sirva la página ante un POST sin Server Action no se
  probó.
- Solo pagos únicos: las suscripciones de `payments` no se muestran.
- El formulario de reembolso es un campo con estado propio, no React Hook Form;
  cumple las reglas de accesibilidad de `CONVENTIONS.md`.
- El cuerpo de `hasPermission` se castea: su tipo se infiere de los permisos
  generados y `payment` solo existe ahí después de `pnpm modules:sync`.

## Sin probar
Las pruebas de `tests/` son de lógica pura y corren con `node --test` (16
casos). No se probó: las páginas renderizadas, las Server Actions contra una
base y un proveedor de prueba, `hasPermission` con roles dinámicos, ni e2e/axe.

## Variables de entorno
Ninguna propia (las de `payments`).

## Datos de ejemplo
Ninguno (sin `seed`).

## Instalar
1. Tener instalado `payments`.
2. Copiar la carpeta a `modules/payments-admin/`.
3. `pnpm modules:sync` (registra permisos, navegación, textos y dos shims:
   `app/(app)/admin/payments/page.tsx` y `app/(marketing)/pago/retorno/page.tsx`).
4. `pnpm modules:check && pnpm typecheck`.

## Desinstalar
Sin migraciones: verificar con `pnpm tsx scripts/modules.ts can-remove payments-admin`,
borrar la carpeta y `pnpm modules:sync`. Las apps que usaban `paymentReturnPath`
deben cambiar su `returnPath`.

## Qué NO toca
Ningún archivo fuera de su carpeta, ningún ancla ni zona protegida, ni el
módulo `payments`.
