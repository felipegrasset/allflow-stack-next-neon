# reports — Paneles de KPIs y gráficos

> Lee solo este archivo y `manifest.json` para instalarlo, usarlo o quitarlo.

## Qué hace
Muestra paneles («dashboards») con tarjetas de indicadores sobre tablas que la app ya tiene:
conteo, suma, promedio, serie por día/semana/mes y desglose por columna. Un panel es una
**definición en datos** (JSON validado con Zod), no SQL: declara qué tablas y columnas puede leer
(su lista blanca) y qué tarjetas mostrar. El motor arma cada consulta con Kysely, cita los
identificadores y pasa todo valor como parámetro; jamás interpola texto. Los gráficos son SVG
propio con tokens del tema (el template no trae librería de gráficos).

## Qué expone
- **Rutas:** `/reports` (lista de paneles) y `/reports/[id]` (un panel, calculado en cada visita).
  Ambas exigen sesión con onboarding y el permiso `report:view`; si no, la página 403.
- **Tabla `reports_dashboards`** (migración `0104_reports_init`): `id` text pk (slug, también la URL),
  `definition` jsonb (la definición completa), `position` int (orden en la lista), `created_at`, `updated_at`.
  La definición se valida al guardar y otra vez al leer; si la guardada no es válida, el panel muestra
  un aviso en vez de romperse (y se registra en consola).
- **Permisos:** recurso `report` con `view` y `edit`. owner y admin reciben los dos; member, ninguno.
  Se comprueban con `auth.api.hasPermission` de Better Auth en la organización de la app, así que
  también cuentan los roles editados en tiempo de ejecución (`organizationRole`).
  - `view`: ver todos los paneles. **Son totales de toda la app** (no se filtran por persona): por eso
    member no lo tiene por defecto.
  - `edit`: subir, bajar o quitar tarjetas desde la pantalla. **No** permite cambiar las fuentes: qué
    tablas y columnas lee un panel lo decide solo el código.
- **Navegación:** enlace «Reportes» (área principal, visible solo con `report:view`: owner/admin o un rol propio que lo tenga). La página lo comprueba de nuevo.
- **Textos:** `messages.ts`, espacio `reports` en `es` y `en`. Los títulos de paneles y tarjetas son
  datos de cada definición: un texto, o `{ es, en }`.
- **Entidades que cubre (`covers`):** tablero, dashboard, reporte, report, informe.
- **`contracts/`** (lo único importable por otro módulo o por la app):
  - `defineDashboard(input)` → `Dashboard`. Puro; valida y aplica valores por defecto; lanza `ZodError`.
  - `saveDashboard(def, { db?, overwrite?, position? })` → `{ id, created }`. Solo servidor. Sin
    `overwrite` es idempotente y **no pisa** un panel ya guardado (respeta lo que se editó en pantalla).
  - `dashboardSchema`, `cardSchema`, `resolveText`, constantes (`DENIED_TABLES`, `DENIED_COLUMN`,
    `COLUMN_TYPES`, `INTERVALS`, `FILTER_OPS`) y tipos (`Dashboard`, `DashboardInput`, `Card`, `Source`,
    `Metric`, `Filter`, `Interval`, `LocalizedText`…).

## La definición
```ts
import { defineDashboard, saveDashboard } from "@/modules/reports/contracts"

export const ventas = defineDashboard({
  id: "ventas",                                   // slug → /reports/ventas
  title: { es: "Ventas", en: "Sales" },
  rangeDays: 30,                                  // KPIs y desgloses: últimos 30 días (opcional; sin él, todo)
  sources: {                                      // LA LISTA BLANCA: nada fuera de acá se lee
    orders: {
      table: "orders",
      dateColumn: "created_at",                   // necesaria para series y para rangeDays
      columns: { created_at: "date", total: "number", status: "text", paid: "boolean" },
    },
  },
  cards: [
    { kind: "kpi", id: "pedidos", title: "Pedidos", source: "orders" },                       // conteo
    { kind: "kpi", id: "ingresos", title: "Ingresos", source: "orders",
      metric: { fn: "sum", column: "total" }, currency: "CLP",
      filters: [{ column: "paid", op: "eq", value: true }] },
    { kind: "series", id: "diario", title: "Pedidos por día", source: "orders", interval: "day", points: 30 },
    { kind: "breakdown", id: "estado", title: "Por estado", source: "orders", by: "status", limit: 8 },
  ],
})

// en un seed (idempotente):  await saveDashboard(ventas, { db })
// para reemplazar una versión anterior:  await saveDashboard(ventas, { db, overwrite: true })
```
Reglas que valida el esquema:
- Identificadores simples (`[A-Za-z_][A-Za-z0-9_]*`, máx. 63): sin puntos (solo esquema `public`), comillas ni espacios.
- Tablas prohibidas siempre: `session`, `account`, `verification`, `kysely_migration*`, `rate_limit_hit`,
  `organizationRole`. Columnas prohibidas siempre: las que contienen pass, secret, token, hash, salt, api_key.
- Métrica: `count` (por defecto), `sum` o `avg` sobre una columna `number` de la lista.
- Filtros (máx. 5, unidos con AND): `eq`, `neq`, `gt`, `gte`, `lt`, `lte` con valor del tipo de la
  columna (fecha = texto ISO; booleano solo `eq`/`neq`), y `null` / `not_null` sin valor.
- Serie: necesita `dateColumn`; `interval` `day|week|month`; `points` 2–366 (por defecto 12), hasta el período actual.
- Desglose: `by` es una columna `text` o `boolean`; `limit` 1–20 (por defecto 8), mayor valor primero.
- Máx. 10 fuentes, 50 columnas por fuente y 24 tarjetas; ids de tarjeta únicos.

Lectura de los números: un conteo vacío es 0; una suma o un promedio sin filas es «Sin datos» (no 0).
En una serie, el período sin filas es 0 para conteo y suma y un hueco en la línea para promedio.
Los períodos se agrupan en UTC (`date_trunc` de Postgres; las semanas empiezan el lunes).

## Componentes (`ui/`, internos)
Solo tokens del tema (`stroke-primary`, `fill-muted-foreground`, `bg-muted`…), sin colores literales.
- `SeriesChart({ points, alt, caption, periodLabel, valueLabel })`: línea SVG con texto alternativo y tabla
  oculta para lectores de pantalla; los `null` cortan la línea.
- `BreakdownBars({ items, label })`: lista ordenada con el valor en texto; las barras son decorativas.
- `KpiValue`, `CardFrame`, `EmptyState`.

## Variables de entorno
Ninguna. Sin dependencias nuevas.

## Datos de ejemplo
`seed.ts` guarda el panel «Usuarios» (`/reports/usuarios`, en `demo.ts`) sobre la tabla del núcleo
`"user"`: total, con correo verificado, que completaron el inicio, altas por semana (12) y desglose por
idioma. Su lista blanca deja fuera nombre, correo e imagen. Idempotente. Sin paneles, `/reports`
muestra un estado vacío que explica cómo crearlos.

## Instalar
1. Copiar la carpeta a `modules/reports/`.
2. `pnpm modules:sync` (registros y shims de `/reports` y `/reports/[id]`).
3. `pnpm db:migrate` (aplica `0104_reports_init` y corre el seed).
4. Para un panel propio: `defineDashboard` + `saveDashboard` en el seed de la app o de otro módulo.

## Desinstalar
1. `pnpm tsx scripts/modules.ts can-remove reports`.
2. Revertir `0104_reports_init` (borra la tabla y todas las definiciones) **antes** de borrar la carpeta.
3. Borrar `modules/reports/` y `pnpm modules:sync`. Quita antes cualquier llamada a `saveDashboard` de otro código.

## Límites conocidos (v0.1)
- Sin editor visual: los paneles se crean y cambian en el código. La pantalla solo reordena o quita tarjetas
  (quitar no se deshace salvo volviendo a guardar con `overwrite: true`).
- Una tarjeta lee una sola tabla: sin joins. Sin filtros elegidos por quien mira (período fijo por panel).
- Sin alcance por persona u organización: todo se calcula sobre la tabla completa. No sirve para mostrar a un
  usuario «sus» datos.
- Sin caché: cada visita corre una consulta por tarjeta (pool de 5 conexiones). Para tablas grandes, índices en
  `dateColumn` y en las columnas de filtro.
- Que una columna exista en la base no se valida al guardar: si falta, esa tarjeta muestra «No se pudo calcular».
- Zona horaria fija UTC.

## Pruebas
`tests/reports.test.ts` (`node:test`, sin base): validación de la definición (lista blanca, tablas y columnas
prohibidas, tipos), el SQL compilado con un dialecto Postgres de prueba (identificadores citados, valores como
parámetros), períodos, ediciones de tarjetas, geometría de gráficos, catálogos `es`/`en` y, leyendo el código,
que cada acción y página pasa por la guarda de permiso. **Sin probar:** la migración, `saveDashboard`, las
consultas contra Postgres real, las páginas renderizadas en Next y `hasPermission` de Better Auth.

## Qué NO toca
Ningún archivo ancla ni zona protegida; no importa de otros módulos salvo `@/modules/i18n/contracts`.
