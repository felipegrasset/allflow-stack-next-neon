# export — Exportar a CSV (v0.1)

> Contrato en texto plano. Un agente que usa este módulo lee SOLO este archivo y `manifest.json`.

## Qué hace
Convierte listados en archivos CSV que abren bien en Excel y Google Sheets, y los entrega por una ruta que comprueba la sesión y el permiso que declaró el módulo dueño del listado. Solo CSV; sin paquetes nuevos.

## Qué expone
- **Ruta:** `GET /api/export/[id]` (`server/route.ts`; handler de ruta, se autentica solo). Respuestas: 200 `text/csv`; `{ error }` con 401 `unauthorized`, 403 `forbidden`, 404 `not_found`, 413 `too_many_rows`, 500 `failed`. Orden: sesión, destino, permiso y solo entonces la consulta.
- **Tablas, navegación, permisos propios, `covers`, seed:** ninguno. El permiso lo pone quien registra el destino.
- **Textos:** `messages.ts`, espacio `export` (`button.*`, `errors.*`) en `es` y `en`.
- **`contracts/csv.ts`** (puro, sirve en servidor, cliente y pruebas): `toCsv`, `csvResponse`, `escapeCell`, `neutralizeFormula`, `cellText`, `safeFileName`, `attachmentHeader`, `BOM`, tipos `CsvColumn`, `CsvOptions`.
- **`contracts/index.ts`** (servidor): lo anterior más `registerExport`, `exportGet`, `DEFAULT_MAX_ROWS` y los tipos `ExportDestination`, `ExportContext`, `ExportData`.
- **`contracts/export-button.tsx`** (cliente): `ExportButton`.

## Cómo se usa desde otro módulo

### CSV directo
```ts
import { toCsv, csvResponse } from "@/modules/export/contracts/csv"

const csv = toCsv(rows, [
  { header: "Nombre", key: "name" },
  { header: "Monto", value: (r) => r.amount },   // `value` gana sobre `key`
], { bom: true, delimiter: ";" })
return csvResponse(csv, { filename: "pedidos-2026-11" })
```
- Escapado RFC 4180: comillas si hay delimitador, comilla, salto de línea o espacios en los bordes; líneas con CRLF.
- **Inyección de fórmulas:** una celda de TEXTO que empieza con `=`, `+`, `-`, `@`, tabulación o retorno (también tras espacios) se antepone con `'`. Los números reales (`number`, `bigint`) no se tocan, ni el texto que es solo un número negativo (`-12.5`, porque Postgres entrega los numéricos como texto). Los encabezados se protegen igual. Ojo: un teléfono `+56…` guardado como texto saldrá como `'+56…`; es el precio de la protección.
- Valores: `null`/`undefined` y números no finitos van vacíos; `Date` en ISO 8601; booleanos `true`/`false`; objetos como JSON.
- `bom` (por defecto `false` en `toCsv`; el handler lo pone en `true`) antepone el BOM UTF-8 que Excel necesita para leer tildes. `delimiter: ";"` para Excel en configuración regional chilena o española.

### Registrar un destino
```ts
// modules/<tu-modulo>/server/exports.ts
import { registerExport } from "@/modules/export/contracts"

registerExport({
  id: "tickets",                                // /api/export/tickets
  permission: { ticket: ["manage"] },           // OBLIGATORIO: todos estos pares
  query: async ({ searchParams }) => ({         // valida searchParams con Zod
    rows: await listAllTickets(),
    columns: [{ header: "Asunto", key: "subject" }, { header: "Estado", key: "status" }],
  }),
  // opcionales: filename, delimiter, bom (true), maxRows (50 000)
})
```
`registerExport` lanza si falta el permiso, si el id no es `[a-z0-9][a-z0-9_.-]{0,63}` o si `query` no es función. Volver a registrar el mismo id lo reemplaza. El permiso se comprueba con `can()` de `@/server/module-access` (Better Auth, roles estáticos y dinámicos). `query` recibe `{ userId, request, searchParams }` y **tiene que acotar los datos él mismo**: el permiso dice quién puede exportar, no qué filas.

### Importante: que el registro se ejecute donde se sirve la ruta
El registro vive en memoria (`globalThis`). Solo existe si el archivo que llama a `registerExport` se cargó en el mismo proceso que atiende `GET /api/export/[id]`. En una app desplegada en Vercel cada ruta puede ser su propia función, y la ruta de este módulo no importa a los demás: **un destino que solo se registra en un archivo que la ruta no carga responde 404**. Dos salidas:
1. **Recomendada:** el módulo dueño declara su propia ruta y la ata al destino, sin registro:
   ```ts
   // modules/<tu-modulo>/server/export-route.ts   (manifiesto: routes[] { path: "/api/<tu-modulo>/export", entry: "server/export-route.ts" })
   import { exportGet } from "@/modules/export/contracts"
   export const GET = exportGet({ id: "tickets", permission: { ticket: ["manage"] }, query: … })
   ```
   Misma comprobación de sesión y permiso, mismo CSV; y el botón apunta ahí (hoy `ExportButton` solo llama a `/api/export/<id>`, ver «Límites»).
2. Importar el archivo de registro desde algo que la ruta sí cargue (no hay un punto de extensión en este módulo para eso).

### Botón
```tsx
import { ExportButton } from "@/modules/export/contracts/export-button"
<ExportButton id="tickets" params={{ status: "open" }} />
```
Descarga con `fetch` y muestra el error traducido si falla (sesión, permiso, demasiados registros, red). Props: `id`, `params` (se envían como query string), `label`, `variant` (`outline`), `size` (`sm`), `disabled`, `className`.

## Variables de entorno
Ninguna.

## Datos de ejemplo
Sin tablas ni seed.

## Instalar
1. Copiar la carpeta a `modules/export/`.
2. `pnpm modules:sync` (escribe el shim `app/api/export/[id]/route.ts` y el catálogo de textos). Sin `pnpm install` ni migraciones.

## Desinstalar
Sin tablas: `pnpm tsx scripts/modules.ts can-remove export`, borrar `modules/export/` y `pnpm modules:sync`. Antes, que nadie importe `@/modules/export/contracts`.

## Límites conocidos
- **El registro no cruza funciones** (arriba). Es el punto débil de este diseño; por eso existe `exportGet`.
- `ExportButton` solo sabe llamar a `/api/export/<id>`; para una ruta propia (`exportGet`) hace falta un `<a href>` o un botón propio por ahora.
- Todo se arma en memoria: tope `maxRows` (50 000 por defecto) con 413, sin streaming ni exportación en segundo plano.
- Una celda de texto que empieza con `-` y no es un número simple (`-foo`) sale con `'` delante.
- Sin Excel (.xlsx), sin importación, sin paginar por rangos.

## Pruebas
`tests/export.test.ts`, sin base ni Next: escapado, fórmulas, BOM, delimitador, nombres de archivo, registro, handler con dependencias inyectadas (401/403/404/413/500, que la consulta no corre sin permiso), ayudas del botón, catálogo y manifiesto. Sin probar: `ExportButton` en un navegador, la ruta con sesión real y `can()` con el recurso de otro módulo (requiere `modules:sync`), y apertura del archivo en Excel.

## Qué NO toca
Ningún archivo ancla ni zona protegida.
