# catalog — catálogo de productos (v0.1)

Productos con atributos libres, categorías, fotos y stock. El stock **no es un
número editable**: es la suma de los movimientos del producto
(`catalog_stock_moves`). Precio en **unidad menor + moneda** (CLP 1990 → `1990`;
USD 15,50 → `1550`). Trae la administración (`/catalog`), una tienda pública de
solo lectura (`/productos`) y un contrato para que `orders` cobre y descuente
stock sin carreras.

Depende de `storage` (fotos). No depende de `payments`.

## Qué trae

| Pieza | Dónde |
|---|---|
| Tablas `catalog_categories`, `catalog_items`, `catalog_stock_moves` (migración `0106_catalog_init`) | `db/` |
| `/catalog` — lista con stock, búsqueda y filtro por estado; nuevo producto y categorías (con `item:write`) | `ui/admin-page.tsx` |
| `/catalog/[id]` — ficha: editar, fotos, stock y sus movimientos | `ui/item-page.tsx` |
| `/productos` — tienda pública (sin sesión): productos `active`, por categoría (`?categoria=<slug>`) y búsqueda (`?q=`) | `ui/public-list-page.tsx` |
| `/productos/[slug]` — ficha pública: fotos, precio, disponibilidad, atributos | `ui/public-item-page.tsx` |
| API de servidor para otros módulos | `contracts/index.ts` |
| Tipos, reglas puras y dinero (también para componentes de cliente) | `contracts/types.ts`, `contracts/domain.ts`, `contracts/money.ts` |
| Permisos `item: read, write` | `permissions.ts` |
| Enlace «Catálogo» (`catalog.nav`, visible con `item:read`) | `nav.ts` |
| Textos `catalog.*` en `es` y `en` | `messages.ts` |
| Seed: 3 categorías, 4 productos de un almacén de barrio inventado, stock inicial | `seed.ts` |

`covers`: producto, product, artículo, item, categoría, category, inventario,
inventory, stock, existencia, movimiento de stock, stock movement.

## Modelo

- **Producto** (`catalog_items`): `slug` único (la dirección pública), `name`,
  `description`, `category_id`, `price_minor` (bigint ≥ 0), `currency` (ISO 4217),
  `attributes` (jsonb, objeto plano), `status` (`draft` | `active` | `archived`),
  `track_stock`, `sku` (único, opcional). Solo `active` se ve en la tienda y se
  puede vender. No se borra: se archiva (los movimientos lo referencian con
  `on delete restrict`).
- **Atributos**: objeto plano de hasta 30 claves (1–60 caracteres) con valores
  texto (≤ 200), número finito o booleano (`checkAttributes`). El formulario los
  escribe como texto, uno por línea: `Color: Rojo` (quedan como texto).
- **Categoría** (`catalog_categories`): `slug` único, `name`, `description`, `position`.
- **Movimiento** (`catalog_stock_moves`): `qty` con signo y `reason`:
  `initial` (> 0, al crear), `restock` (> 0), `adjustment` (≠ 0, nunca deja el
  stock bajo cero), `sale` (< 0, con `ref`) y `sale_reverted` (> 0, misma `ref`).
  La base exige el signo según el motivo y la `ref` en ventas; un índice único
  `(item_id, reason, ref)` hace que una venta y su reversa ocurran **una vez por
  referencia**.
- **`track_stock = false`** (servicios, digitales): sin movimientos, nunca se agota.

## Garantías del stock

Toda escritura de movimientos pasa por `server/stock.ts`:

1. abre una transacción (o usa la del llamador),
2. bloquea las filas de los productos con `select … for update`, **en orden de id**
   (dos reservas con los mismos productos no se bloquean mutuamente),
3. lee la suma de movimientos,
4. decide con las reglas puras de `contracts/domain.ts`,
5. inserta.

Dos checkouts que compiten por la última unidad quedan en fila por el bloqueo:
el segundo ve el movimiento del primero y falla con `insufficient_stock`.

## Cómo se usa desde otro módulo (checkout)

```ts
import {
  getSellableItems,
  reserveStock,
  releaseStock,
  StockError,
} from "@/modules/catalog/contracts"

// 1) Precios SIEMPRE desde el catálogo, nunca del navegador.
const items = await getSellableItems(cart.map((l) => l.itemId))
if (items.length !== new Set(cart.map((l) => l.itemId)).size) /* algo ya no está a la venta */
// total = Σ item.priceMinor * qty, por moneda (item.currency); no mezclar monedas.

// 2) Pedido + stock, todo o nada, en TU transacción:
await getKysely().transaction().execute(async (trx) => {
  await trx.insertInto("orders_orders").values({ id: orderId, … }).execute()
  await reserveStock(
    { ref: `order:${orderId}`, lines: cart.map((l) => ({ itemId: l.itemId, qty: l.qty })) },
    { db: trx },
  ) // lanza StockError → se revierte también el pedido
})

// 3) Pedido cancelado, vencido o pago rechazado:
await releaseStock({ ref: `order:${orderId}` })
```

API de `@/modules/catalog/contracts` (servidor; **ninguna función comprueba
sesión ni permisos**: las llama código que ya lo hizo). Todas aceptan un
último argumento opcional `{ db }` para correr dentro de una transacción tuya.

| Función | Qué hace |
|---|---|
| `getSellableItem(itemId, opts?)` | `SellableItem` (`id`, `slug`, `name`, `sku`, `priceMinor`, `currency`, `trackStock`, `available`) o `null` si no existe o no está `active` |
| `getSellableItems(itemIds, opts?)` | Varios; omite los que no existen o no están `active` (compara largos) |
| `getItem(itemId, opts?)` | Cualquier producto (cualquier estado) con su `stock` (`null` si no lo controla) |
| `getStock(itemId, opts?)` | Stock actual (suma). Es una lectura, no una garantía |
| `reserveStock({ ref, lines, createdBy? }, opts?)` | Descuenta todas las líneas o ninguna, una vez por `ref`. Repetida con la misma `ref` → `{ status: "already_applied" }` sin cambios. Lanza `StockError` |
| `releaseStock({ ref, createdBy?, note? }, opts?)` | Devuelve lo que tomó esa `ref` (`released`); otra vez → `already_released`; si no tomó nada → `nothing`. Sirve aunque el producto esté archivado |
| `listStockMovesByRef(ref, opts?)` | Los movimientos de una referencia (para mostrar qué tomó o devolvió un pedido) |
| `listCategories(opts?)` | Categorías por `position` y nombre |
| `listItemPhotos(itemId)` | Fotos (archivos de `storage`, públicos); `[0]` es la portada; `f.url` → `/api/storage/<id>` |
| `itemPublicPath(slug)` | `/productos/<slug>` |

`StockError` tiene `code`: `invalid_input` (ref o cantidades inválidas; cantidad
entera 1–100 000; líneas repetidas se suman), `item_not_found`,
`item_unavailable` (no `active`), `insufficient_stock` (con `itemId`,
`available`, `requested`) o `already_released` (esa `ref` ya se liberó: usa una
nueva). `ref`: letras, dígitos y `_.:-`, hasta 200 (`isRef`); por convención
`order:<id>`.

También exporta lo puro: tipos (`Item`, `ItemWithStock`, `SellableItem`,
`StockMove`, `StockLine`, `Category`, `Attributes`, …), constantes
(`ITEM_STATUSES`, `MOVE_REASONS`, `CURRENCIES`, `CATALOG_PHOTO_ENTITY`,
`MAX_QTY`), reglas (`slugify`, `isRef`, `mergeLines`, `planReservation`,
`checkAttributes`, `isAttributes`) y dinero (`currencyExponent`, `minorToMajor`,
`parseAmount`, `formatAmountInput`). Un componente de cliente los importa desde
`@/modules/catalog/contracts/types` o `/money` (el `index` es de servidor).

## Permisos

- `item:read` — ver `/catalog` y `/catalog/[id]`.
- `item:write` — crear y editar productos y categorías, registrar movimientos,
  agregar y quitar fotos.
- owner y admin: todo. member: solo `read`. Para quien lleva el inventario, un
  rol dinámico con `item:write`.
- Cada página y cada Server Action comprueba su permiso con `can()` de
  `@/server/module-access` (Better Auth; roles estáticos y dinámicos). Las
  acciones comprueban sesión y permiso **antes** de validar y escribir.
- La tienda pública no pide sesión ni permiso y solo muestra productos `active`.
- Fotos: se suben con `FileInput` de `storage` (pide `file:upload`), se ligan
  como `public` a `entity: "catalog_item"`; para quitar una se exige además la
  regla de `storage` (`canAccessFile(…, "delete")`: quien la subió o un admin).

## Límites conocidos

- **Sin variantes** (talla/color con stock propio): un producto = un stock. Hoy
  se modelan como productos separados.
- **Sin reservas temporales con vencimiento**: `reserveStock` descuenta de
  inmediato; liberar al vencer un pago es trabajo de `orders` (`releaseStock`).
- **Stock calculado en cada lectura** (suma con índice por producto). Bien para
  miles de movimientos por producto; con mucho volumen haría falta un saldo
  materializado mantenido en la misma transacción.
- **Categorías**: solo crear y listar (sin editar, reordenar ni borrar desde la
  UI); un nivel, sin subcategorías.
- **Fotos**: sin reordenar (la portada es la primera subida); la tienda pide la
  portada de cada producto con una consulta por producto (≤ 60 por página).
- **Tienda**: primeros 60 resultados, sin paginar; sin botón de compra (lo pone
  `orders`); las rutas re-exportan solo `default`, así que no hay
  `generateMetadata` por producto.
- **Atributos** desde el formulario quedan como texto; números y booleanos solo
  entran por código.
- **Moneda**: el formulario ofrece `CURRENCIES` (CLP, USD, EUR, MXN, ARS, PEN,
  COP); cada producto tiene una, y no se convierte.

## Pruebas

- `tests/catalog.test.ts` — sin base: slugs, `ref`, atributos, dinero, reglas
  de stock (todo o nada, liberar, ajustes), esquemas Zod, paridad `es`/`en`,
  permisos, manifiesto, y —leyendo el código— que cada acción comprueba permiso
  antes de escribir y que el stock se bloquea antes de insertar.
  **Se ejecutó (18/18)**, transpilada fuera del repo.
- `tests/catalog-db.test.ts` — contra Postgres (se salta sin `DATABASE_URL`):
  stock como suma, la última unidad con diez checkouts concurrentes (gana uno),
  todo o nada, reserva y liberación idempotentes, rollback dentro de la
  transacción del llamador, SKU único. **Sin ejecutar todavía** (se comprobó que
  carga y se salta).
- Sin probar: las páginas en un navegador, `can({ item: … })` con roles reales
  (requiere `modules:sync`), y la subida de fotos de punta a punta.

## Quitar

Seguir `modules/README.md` («Desinstalar»). Antes: que ningún módulo (p. ej.
`orders`) importe `@/modules/catalog/contracts`. Revertir `0106_catalog_init`
borra las tres tablas y su historial de stock; **no** borra las fotos en
`storage` (`entity = 'catalog_item'`): bórralas antes si corresponde.
