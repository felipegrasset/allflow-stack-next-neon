# discounts — cupones y códigos de descuento (v0.1)

> Contrato en texto plano. Un agente que instala o usa este módulo lee SOLO este
> archivo y `manifest.json`. **Este módulo toca dinero**: las reglas de abajo no
> son de estilo.

## Qué hace
Códigos de descuento para los pedidos de `orders`: porcentaje o monto fijo, con
vigencia, compra mínima, tope de usos total y por persona, y activo/inactivo. El
equipo los gestiona en `/admin/discounts`; la persona escribe el código en
`/orders/[id]/descuento` (o en `<DiscountCodeForm>`) **antes de pagar**. Depende
de `orders` (su punto `applyOrderDiscount`) y de `catalog` (solo sus ayudas de
dinero puras, `catalog/contracts/money`). Solo importa `contracts/`.

```
persona escribe "verano 10" ─► acción (sesión + límite de tasa) ─► una transacción:
   bloqueo del pedido (advisory) → bloqueo de la fila del código → cuenta usos activos
   → applyDiscount(regla, pedido GUARDADO) → libera el uso anterior (si había)
   → inserta el uso (el trigger vuelve a contar) → orders.applyOrderDiscount({ db: trx })
   ─► commit: el uso y el descuento del pedido quedan juntos, o ninguno
```

## Reglas de dinero (y su prueba)
Pruebas puras en `tests/discounts.test.ts` (**se ejecutaron: 23/23**,
transpiladas con `transpileModule` y `node --test`) y contra Postgres en
`tests/discounts-db.test.ts` (**escritas, sin ejecutar**: no hay Postgres en
esta máquina; se saltan sin `DATABASE_URL`). Las de base usan un `orders`
falso sobre una tabla del esquema de prueba, con las mismas reglas del punto de
descuento (bloqueo de fila, solo `pending`, no vencido, sin pago, total ≥ 1).

1. **Se calcula siempre en el servidor desde el pedido guardado.** Del navegador
   llegan solo `orderId` y el texto del código (`redeemSchema` descarta todo lo
   demás). `redeemCode` lee el pedido con `getOrder(…, { db: trx })` y calcula con
   `applyDiscount`. **Redondeo:** el porcentaje se calcula en enteros (BigInt) y
   se redondea **hacia abajo** a la unidad menor (15 % de CLP 999 = 149); después
   todo descuento se topa en `subtotal − 1`, así que el total nunca baja de 1
   (lo exige `orders`; un monto fijo mayor que el subtotal deja total 1). Un
   descuento que redondea a 0 es `no_effect`. El monto fijo solo aplica en la
   moneda del código. Pruebas: «rule 1: …» (5 puras) y «rule 1» (base).
2. **Condiciones** (todas opcionales salvo el tipo): vigencia `starts_at`
   (incluido) – `ends_at` (excluido), compra mínima sobre el subtotal antes del
   descuento (en la moneda del código), tope total, tope por persona (la persona
   es el comprador del pedido), activo. Un porcentaje con moneda solo sirve en
   esa moneda. **Códigos normalizados** (`normalizeCode`: NFKC, sin ningún
   espacio, mayúsculas, `A-Z 0-9 _ -`, 3..40) y guardados así, con `unique`: se
   comparan sin distinguir mayúsculas ni espacios. Pruebas: «rule 2: …» (7 puras)
   y «conditions on a real order» (base).
3. **El tope lo garantiza la base.** En la transacción del canje se bloquea la
   fila del código (`select … for update`) y se cuentan sus usos activos antes
   de insertar; además el trigger `discounts_enforce_caps` (0127) hace el mismo
   bloqueo y conteo en **cada** insert, venga de donde venga. Dos canjes del
   último uso → uno gana, el otro `exhausted`. Si el tope parece alcanzado, antes
   de rechazar se liberan (hasta 20) usos de pedidos ya cancelados/vencidos que
   nadie barrió. Pruebas: «rule 3: …» (2 puras, lectura del orden de llamadas) y
   en base 8 canjes concurrentes del último uso → 1, 5 concurrentes de una persona
   con tope 1 → 1, y un insert directo pasado el tope rechazado por el trigger.
4. **Un canje por pedido.** Índice único parcial `(order_id) where released_at is
   null` + bloqueo advisory por pedido. Aplicar otro código libera el anterior
   (`replaced`) e inserta el nuevo en la misma transacción; el mismo código otra
   vez no cambia nada; quitar el descuento libera el uso (`removed`) y deja el
   pedido en 0. **Pedido cancelado o vencido → el uso se libera** con
   `releaseDiscountForOrder(orderId)` (idempotente, segura en paralelo); un
   pedido pagado confirma el uso (`confirmed_at`, definitivo). Un uso liberado
   nunca se reactiva (trigger). Pruebas: «rule 4: …» (2 puras) y 4 en base
   (reemplazo, quitar, 5 liberaciones concurrentes → 1, uso viejo que no bloquea).
5. **Una sola transacción.** El insert del uso y `applyOrderDiscount(…, { db: trx })`
   van juntos: si `orders` se niega (`payment_started`, `expired`,
   `invalid_status`, `invalid_discount`) se revierte también el uso. Ningún error
   de base se atrapa dentro de la transacción. Pruebas: «rule 5: …» (2 puras) y
   en base un pedido con pago iniciado → ni uso ni descuento.
6. **No revela códigos y limita intentos.** Sin sesión, la respuesta es siempre
   «inicia sesión», antes de mirar ningún código. Con sesión: «no existe»,
   «inactivo» y «todavía no empieza» responden igual (`invalid_code`); vencido,
   agotado, tope por persona, compra mínima y moneda sí se dicen (ya hay sesión y
   límite). Límite de tasa con `consume()` de `@/server/rate-limit`, antes de
   validar: 10/min por IP y 30/hora por persona. Un pedido ajeno responde igual
   que uno inexistente. Pruebas: «rule 6: …» (2 puras).

## Qué expone
- **Rutas:** `/admin/discounts` (crear, editar, activar/desactivar, ver los 50
  usos más recientes de un código; permiso `discount:manage`) y
  `/orders/[id]/descuento` (la persona dueña del pedido; 404 para el resto).
- **Tablas** (migración `0127_discounts_init`): `discounts_codes` (código
  normalizado único, `kind` percent|fixed, `percent_bp` 1..10000, `amount_minor`,
  `currency`, `min_subtotal_minor`, `starts_at`, `ends_at`, `max_uses`,
  `max_uses_per_user`, `active`, `note`) y `discounts_redemptions` (un uso: código,
  pedido, comprador, monto, moneda, subtotal; `released_at` + `release_reason`,
  `confirmed_at`, `checked_at`). Sin llave foránea a pedidos ni usuarios a propósito.
- **Permisos:** `discount: manage` (owner/admin; también `adminAccess`). Canjear
  en tu propio pedido no pide permiso: sesión y ser el comprador.
- **Navegación:** «Descuentos» en el menú de `/admin` (`area: "admin"`).
- **Textos:** `messages.ts` (`discounts.*`, `es`/`en`).
- **covers:** cupón, coupon, descuento, discount, código de descuento, discount
  code, promo code.

### `@/modules/discounts/contracts` (servidor; ninguna función revisa sesión ni permiso)
| Export | Qué hace |
|---|---|
| `releaseDiscountForOrder(orderId)` | Libera el uso de un pedido `canceled`/`expired`/inexistente, lo confirma si está pagado, no hace nada si sigue `pending`/`review`. Idempotente → `ReleaseOutcome` |
| `releaseStaleDiscounts({ limit? })` | Barrido para una tarea programada (100 por defecto, máx. 1000) → `SweepReport` (conteos) |
| `getActiveDiscount(orderId)` | El uso activo del pedido (código, monto) o null |
| `discountPath(orderId)`, `ADMIN_DISCOUNTS_PATH` | Rutas |
| Puras: `applyDiscount(regla, { subtotalMinor, currency }, { now, usage })`, `normalizeCode`, `parsePercent`, `formatPercent`, `rawAmount`, `cappedAmount`, `rejectionError`, `releaseDecision`, `ruleProblems`, `codeState`, `discountRefOf` | Reglas sin base (`contracts/domain` también se importa directo) |
| Tipos (`contracts/types`): `DiscountRule`, `DiscountCode`, `Redemption`, `DiscountResult`, `DiscountRejection`, `DiscountError`, `DiscountErrorCode`, `ReleaseOutcome`, `SweepReport`, … | |

Componente de cliente: `import { DiscountCodeForm } from "@/modules/discounts/contracts/ui"`
→ `<DiscountCodeForm orderId={order.id} appliedCode={order.discountCode} />`.
Manda solo el id del pedido y el código; refresca la página al aplicar o quitar.

## Cómo se engancha con `orders` (lo hace la app; este módulo no edita `orders`)
1. **Dónde escribir el código.** `orders` no tiene ese espacio. Opciones:
   - un enlace en la página del pedido mientras esté `pending`:
     `<Link href={discountPath(order.id)}>…</Link>`; o
   - el formulario en línea, en la página del pedido o en `/checkout`:
     `<DiscountCodeForm orderId={order.id} appliedCode={order.discountCode} />`.
   Debe ir **antes** de «Pagar»: con un pago abierto `orders` responde
   `payment_started` (este módulo no cancela pagos; la persona espera a que
   venza o lo cancela).
2. **Liberar usos de pedidos cancelados o vencidos.** En la misma tarea que
   vence pedidos, después de `expirePendingOrders()`:
   `await releaseStaleDiscounts()`. Con `jobs`: `defineJob("orders-expire", async () => { await expirePendingOrders(); await releaseStaleDiscounts() }, …)`.
   Si la app cancela pedidos con `cancelOrder`, puede llamar
   `releaseDiscountForOrder(orderId)` justo después (es idempotente). Sin nada
   de esto, un uso de un pedido cerrado igual se libera solo cuando el código
   llega a su tope y alguien intenta usarlo (se revisan hasta 20).

## Límites conocidos
- `orders` no avisa cuando un pedido se cierra: la liberación depende de la tarea
  programada, de una llamada explícita o del rescate perezoso al llegar al tope.
- Los usos cuentan mientras el pedido está `pending` o `review`: un pedido
  abandonado ocupa su uso hasta que vence (TTL de `orders`, 30 min por defecto).
- Editar un código no cambia los pedidos que ya lo tienen; el texto del código no
  se edita; no hay borrado (desactívalo). Bajar un tope por debajo de los usos
  activos se permite (no entra ningún uso nuevo hasta bajar).
- Un solo código por pedido; sin descuentos por producto, categoría o envío; sin
  topes de monto en porcentajes; sin códigos de un solo uso generados en lote.
- Las fechas del formulario se escriben en la hora local del navegador y se
  guardan como instante; por eso el formulario de `/admin/discounts` se dibuja
  solo en el navegador (`next/dynamic`, sin SSR).
- `/admin/discounts` lista los 200 códigos más nuevos, sin paginar ni buscar.

## Sin probar
Las páginas en un navegador, las Server Actions contra una base, `can({ discount: … })`
con roles reales (requiere `modules:sync`), el límite de tasa real, y
`tests/discounts-db.test.ts` (sin Postgres acá).

## Variables de entorno
Ninguna.

## Datos de ejemplo
`seed.ts` (idempotente, ids fijos, `on conflict do nothing`): `BIENVENIDA10`
(10 %, uno por persona) y `DESPACHO2000` (CLP 2.000 desde CLP 15.000, hasta 100
usos). Sin usos (necesitan pedidos reales).

## Instalar
1. Tener `orders` (0.1) y `catalog`.
2. Copiar la carpeta a `modules/discounts/` y `pnpm modules:sync` (permisos, nav,
   textos, la migración y dos shims).
3. `pnpm db:migrate` (aplica 0127 y el seed).
4. Enganchar con `orders` (ver arriba). 5. `pnpm modules:check && pnpm typecheck`.

## Desinstalar
`pnpm tsx scripts/modules.ts can-remove discounts`, respaldar
(`pg_dump -t 'discounts_*'`), revertir `0127_discounts_init` (borra las dos
tablas y sus dos funciones de trigger), borrar la carpeta y `pnpm modules:sync`.
Los pedidos conservan su `discount_minor`/`discount_code` (son de `orders`).
Antes, quitar los enlaces o el `<DiscountCodeForm>` que haya puesto la app.

## Qué NO toca
Nada fuera de su carpeta: ni anclas, ni zonas protegidas, ni `orders` ni `catalog`.
