# orders — carrito, checkout y pedidos (v0.1)

> Contrato en texto plano. Un agente que instala o usa este módulo lee SOLO este
> archivo y `manifest.json`. **Este módulo mueve dinero**: las reglas de abajo
> no son de estilo.

## Qué hace
Carrito anónimo (cookie firmada), checkout con sesión, pedidos con estados,
stock reservado en `catalog` y cobro con `payments`. Depende de `catalog`,
`payments` y `notifications` (solo sus `contracts/`).

```
/carrito ──► /checkout ──► pedido `pending` (stock reservado) ──► Pagar ──► proveedor
                                  │                                         │
                                  │ vence / se cancela                      ▼
                                  ▼                       /orders/[id]?pago=1 (concilia)
                   `expired` / `canceled`                                  │
                   (stock liberado una vez)          approved y monto igual ▼
                                                     `paid` ──► `fulfilled` (equipo)
                     needs_review / monto distinto ──► `review` (lo mira una persona)
```

## Reglas de dinero (y su prueba)
Pruebas puras en `tests/orders.test.ts` (**se ejecutaron: 26/26**) y contra
Postgres en `tests/orders-db.test.ts` (**escritas, sin ejecutar**: no hay
Postgres en esta máquina; cargan y se saltan sin `DATABASE_URL`).

1. **El total se calcula siempre en el servidor desde `catalog`.** Del navegador
   llegan solo ids y cantidades (`normalizeCart` descarta cualquier otro campo;
   ningún esquema de acción lleva precio). `createOrder` llama primero
   `reserveStock({ ref: "order:<id>" }, { db: trx })`, que bloquea las filas de
   los productos, y **después** lee los precios con `getSellableItems(…, { db: trx })`:
   el precio leído es el de ese instante y no puede cambiar hasta el commit. Lo
   que `catalog` omite (no vendible) se detecta comparando. Una sola moneda por
   pedido. Enteros en unidad menor, sin pasar de 2^53. El navegador manda el
   subtotal que vio solo para comparar: si cambió, `prices_changed` y no se crea
   nada. `startCheckout` recibe el `total_minor` **guardado**.
   Pruebas: «rule 1: …» (5 puras) y «rule 1+2», «rule 1: if the price changed…» (base).
2. **Cada línea es una foto** (nombre, sku, precio unitario, cantidad, total de
   línea) en `orders_items`. Un trigger impide actualizar líneas, y otro congela
   montos y moneda del pedido apenas sale de `pending`. Prueba: «rule 2» y «rule 1+2».
3. **Pagado solo si `getPaymentByOrder(id)?.status === "approved"`** para ESE
   pedido, con monto **y** moneda iguales al total guardado (`decidePayment`).
   `needs_review`, `refunded` o un monto distinto → `review`, nunca `paid` ni
   `fulfilled`. El paso a `paid` es atómico e idempotente: bloqueo de fila,
   `update … where status = <anterior>`, y un trigger con la tabla de
   transiciones. Entregar (`fulfilled`) vuelve a revisar el pago en ese momento.
   Pruebas: «rule 3: …» (4 puras) y en base 5 llamadas concurrentes → un solo
   `paid`, un aviso, una fila de historial.
4. **Stock reservado al crear y liberado exactamente una vez** al cancelar o
   vencer: `releaseStock({ ref }, { db: trx })` corre en la MISMA transacción que
   cambia el estado a `canceled`/`expired`; la base exige
   `stock_released_at` ⇔ estado cerrado y no deja ponerlo dos veces. Un pedido
   `paid`/`fulfilled` no puede pasar a cancelado (código + trigger). Antes de
   liberar se mira el pago: si ya está aprobado, el pedido pasa a `paid`; si hay
   un checkout abierto (`pending`/`failed`) se cancela con `cancelPayment`
   antes; si `payments` se niega (se acaba de aprobar), se relee y se decide de
   nuevo. Pruebas: «rule 4: …» (4 puras) y en base 6 cancelaciones/vencimientos
   concurrentes → una sola liberación.
   *Decisión*: un intento de pago `failed` **no** libera de inmediato (payments
   dice que no es terminal: la persona puede reintentar en el mismo checkout);
   el stock vuelve al vencer el pedido o si la persona lo cancela.
5. **Un pedido pendiente vence** a los `ORDERS_PENDING_TTL_MINUTES` (30 por
   defecto, entre 5 y 10080) y libera su stock: `expirePendingOrders()` en
   `contracts/`, idempotente y segura en paralelo. Al abrir el pago, el
   vencimiento se extiende a ahora + TTL (para no cancelar un checkout recién
   abierto). Pruebas: «rule 5: …» y «rule 5: the sweep…» (base).
6. **Cada persona ve solo sus pedidos; `order:manage` ve todos** (`/orders`
   filtra por `user_id`; `/orders/[id]` responde 404 a quien no es dueño ni
   gestor). Cada cambio de estado deja fila en `orders_status_history` con
   `actor_kind` (`buyer` | `staff` | `system`) y `actor_id` (null solo para
   `system`, lo exige la base). Pruebas: «rule 6: …».
7. **Carrito en cookie firmada** (`orders_cart`, httpOnly, SameSite=Lax, 30
   días, ≤ 50 productos distintos, ≤ 999 por línea). Por qué cookie y no tabla:
   el carrito es anónimo (la tienda pública no pide cuenta), la mayoría se
   abandona y una cookie no deja filas que limpiar; la especificación pide solo
   tres tablas. Por qué firmada si solo trae ids: así solo la escriben nuestras
   Server Actions (que validan cada línea), una cookie editada se descarta
   entera y su tamaño queda acotado. **No** es lo que mantiene honestos los
   precios: eso es la regla 1. Firma HMAC-SHA256 con una llave derivada de
   `BETTER_AUTH_SECRET` (en producción sin ella, el carrito falla cerrado).
   Pruebas: «rule 7: …».

## Qué expone
- **Rutas:** `/carrito` (pública, grupo `marketing`), `/checkout`, `/orders`,
  `/orders/[id]` (también es la página de retorno del proveedor, `?pago=1`),
  `/admin/orders`, y el handler `GET|POST /api/orders/expire` (tarea programada).
- **Tablas** (migración `0126_orders_init`): `orders_orders`, `orders_items`,
  `orders_status_history`. Sin llave foránea a `"user"` ni a `catalog_items` a
  propósito (otros módulos; el historial sobrevive).
- **Permisos:** `order: read, manage`. owner/admin todo; member `read` (comprar
  y ver los suyos). `order:manage` es `adminAccess`.
- **Navegación:** «Carrito» (`/carrito`, todos), «Pedidos» (`/orders`, con
  `order:read`), «Pedidos» en `/admin` (`area: "admin"`, con `order:manage`).
- **Textos:** `messages.ts` (`orders.*`, `es`/`en`).
- **covers:** pedido, order, orden, orden de compra, purchase order, carrito,
  cart, shopping cart, línea de pedido, order line.
- **Avisos:** al quedar pagado, a quienes tienen `order:manage`
  (`notifyPermission`) y a quien compró (`notify`), idempotentes por pedido.

### `@/modules/orders/contracts` (servidor; ninguna función revisa sesión ni permiso)
| Export | Qué hace |
|---|---|
| `getOrder(id, opts?)`, `getOrderDetail(id, opts?)`, `listOrdersForUser(userId, opts?)` | Lecturas. `OrderDetail` = pedido + `items` (fotos) + `history` |
| `createOrder({ userId, cart, expected? }, opts?)` | Crea un pedido `pending` desde ids + cantidades, con precio de `catalog` y stock reservado, todo o nada. Lanza `OrderError` |
| **`applyOrderDiscount(orderId, { amountMinor, code, ref }, opts?)`** | **El punto de descuento** (ver abajo) |
| `applyOrderPayment(orderId)` | Aplica lo que `payments` sabe: `paid` / `review` / sin cambio. Idempotente. Solo base |
| `cancelOrder(orderId, actor, { asStaff, note? })` | Cancela (libera stock una vez); nunca un pagado |
| `fulfillOrder(orderId, actor)` | `paid → fulfilled`, revisando el pago |
| `expirePendingOrders({ now?, limit?, sync? })` | Vence lo pendiente y libera stock → `ExpireReport` (conteos) |
| `orderPath(id)`, `CART_PATH`, `CHECKOUT_PATH` | Rutas |
| `OrdersDbOptions` (`{ db? }`) | Para correr dentro de tu transacción |
| Puras: `quoteCart`, `normalizeCart`, `totalAfterDiscount`, `decidePayment`, `canTransition`, `canCancel`, `isOrderId`, `stockRefOf`, `shortOrderRef`, `orderDiscountSchema` | Reglas sin base |
| Tipos/constantes (`export *` de `types.ts`): `Order`, `OrderItem`, `OrderDetail`, `OrderHistoryEntry`, `OrderStatus`, `ORDER_STATUSES`, `RELEASED_STATUSES`, `PAID_STATUSES`, `OrderActor`, `ActorKind`, `ACTOR_KINDS`, `SYSTEM_ACTOR`, `CartLine`, `Quote`, `QuotedLine`, `QuoteResult`, `PaymentView`, `ExpireReport`, `MAX_LINE_QTY`, `MAX_CART_LINES`, `OrderError`, `OrderErrorCode`, `ORDER_ERROR_CODES` | |

Componente de cliente: `import { AddToCart } from "@/modules/orders/contracts/ui"`
(`<AddToCart itemId={item.id} />`): manda id y cantidad; el servidor revisa que
sea vendible. Lo puro también se importa desde `contracts/types` y `contracts/domain`.

## Descuentos (para el módulo `discounts`)
`applyOrderDiscount(orderId, { amountMinor, code, ref }, { db?, actor? })`:
- el monto lo calcula **tu código de servidor** (nunca un número de un
  formulario), entero en unidad menor de `order.currency`;
- solo sobre un pedido `pending`, no vencido y **sin pago abierto** (si ya hay
  checkout, `payment_started`: cancelar ese pago es decisión tuya, con
  `cancelPayment` de `payments`);
- `total = subtotal − descuento ≥ 1` (`invalid_discount` si no); se guardan
  `discount_minor`, `discount_code`, `discount_ref` y una fila de historial;
- `{ amountMinor: 0, code: null, ref: null }` lo quita;
- pasa `{ db: trx }` para que el uso del código y el descuento se confirmen juntos;
- después de salir de `pending` la base no deja cambiar montos.
Límite: la página del pedido todavía no tiene un lugar para escribir un código;
`discounts` necesitará su propia pantalla/acción que llame este punto antes de «Pagar».

## Conectar la tarea programada
Elige una:
- **Ruta incluida:** define `CRON_SECRET` (≥ 16 caracteres) y agrega en el
  `vercel.json` de la app (fuera de este módulo):
  `{ "crons": [{ "path": "/api/orders/expire", "schedule": "*/10 * * * *" }] }`.
  Responde 200 con conteos, 401 sin secreto válido, 503 sin `CRON_SECRET`.
- **Con el módulo `jobs`:** un archivo de la app (p. ej. `lib/jobs/orders-expire.ts`)
  con `defineJob("orders-expire", () => expirePendingOrders(), { schedule: "*/10 * * * *" })`,
  su línea en `modules/jobs/register.ts` y el cron `/api/jobs/orders-expire`.
  `orders` no depende de `jobs`.
Sin tarea, los pedidos igual vencen «perezosamente» al abrir su página o al
intentar pagarlos, pero el stock de un pedido abandonado queda tomado hasta entonces.

## Límites conocidos
- **Pago tardío sobre un pedido vencido:** si el proveedor aprueba después de que
  el pedido venció (el webhook llegó tarde y `syncPayment` no pudo confirmarlo),
  `payments` lo marca `needs_review` (pago sobre checkout cancelado): el pedido
  queda `expired`, el stock ya se liberó y hay que reembolsar en `payments-admin`.
- **Webhook sin aviso a `orders`:** `payments` no avisa a otros módulos. El
  pedido pasa a `paid` cuando alguien abre su página, al intentar pagar de
  nuevo, o en la siguiente corrida del vencimiento. Un aviso de `payments`
  (hook) lo haría inmediato: queda pedido (ver informe).
- **Pagado → cancelado/reembolso:** no está modelado. Un reembolso se pide en
  `payments-admin`; `fulfillOrder` lo detecta y no entrega.
- La página de retorno consulta al proveedor con límite (10/min por IP y pedido,
  30/min por IP). Flow vuelve por POST: no se probó en Next 16.
- Sin envío/dirección, sin impuestos, sin variantes (las de `catalog`), sin
  pedidos de invitado (comprar pide cuenta; el carrito no).
- `/admin/orders` muestra los 100 más recientes, sin paginar.
- Notas del historial son códigos internos en inglés; la pantalla no las muestra.
- El tope de 999 por línea es de `orders`; `catalog` acepta hasta 100 000.
- Total 0 (solo productos gratis) no se puede pedir (`zero_total`): `payments` no cobra 0.
- `canSeeOrder` responde 404, no 403, para no confirmar que un id existe.

## Sin probar
Las páginas en un navegador, las Server Actions contra una base y un proveedor
de prueba, `can({ order: … })` con roles reales (requiere `modules:sync`), el
handler de cron de punta a punta, y `tests/orders-db.test.ts` (sin Postgres acá).

## Variables de entorno
`ORDERS_PENDING_TTL_MINUTES` (opcional) y `CRON_SECRET` (para la ruta de
vencimiento; la misma de `jobs` si está instalado). Usa `BETTER_AUTH_SECRET` de
la app para firmar el carrito.

## Datos de ejemplo
Ninguno (sin `seed`): un pedido pagado de ejemplo violaría la regla 3 (no hay
pago aprobado detrás) y uno pendiente tomaría stock real del seed de `catalog`.

## Instalar
1. Tener `catalog` (0.1), `payments` (0.2) y `notifications`.
2. Copiar la carpeta a `modules/orders/` y `pnpm modules:sync` (registra
   permisos, nav, textos, la migración y seis shims).
3. `pnpm db:migrate`. 4. Conectar la tarea programada. 5. `pnpm modules:check && pnpm typecheck`.

## Desinstalar
`pnpm tsx scripts/modules.ts can-remove orders`, respaldar (`pg_dump -t 'orders_*'`),
revertir `0126_orders_init` (borra las tres tablas y sus dos funciones de
trigger), borrar la carpeta y `pnpm modules:sync`. Antes, cancelar o cerrar los
pedidos `pending`: su stock sigue reservado en `catalog` con `ref = order:<id>`.

## Qué NO toca
Nada fuera de su carpeta: ni anclas, ni zonas protegidas, ni `catalog` ni `payments`.
