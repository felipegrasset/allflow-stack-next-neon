# csv-import — Importar desde CSV

> Lee solo este archivo y `manifest.json` para instalarlo, usarlo o quitarlo.

## Qué hace
Carga registros desde un archivo CSV en `/admin/import`: se elige un **destino**, se sube el
archivo, se asigna qué columna alimenta cada campo (con sugerencia automática por el nombre de
la cabecera), se revisa una **vista previa con errores por fila** y se carga. El destino es una
**lista blanca** que otros módulos o la app registran con `registerImportTarget`: un CSV nunca
apunta a una tabla arbitraria. Sin destinos registrados, la pantalla lo dice y no ofrece nada.

El analizador de CSV es propio (sin paquetes nuevos): comillas, comillas dobles escapadas (`""`),
saltos de línea dentro de un campo, BOM, separadores `,` `;` y tabulación (se detecta solo, o se
fuerza), `\r\n` / `\n` / `\r`, líneas en blanco ignoradas y filas de largo distinto (una fila
corta se completa con vacíos; una más larga que la cabecera es un error, para no perder datos
en silencio).

## Qué expone
- **Ruta:** `/admin/import` (sesión + onboarding + permiso `import:run`). Asistente de importación y
  las últimas 20 importaciones (archivo, destino, estado, filas importadas y omitidas, quién, cuándo).
- **Tabla** (migración `0114_csv_import_init`): `csv_import_runs` — `id`, `target`, `file_name`,
  `status` (`done|failed`), `total_rows`, `imported_rows`, `skipped_rows`, `error_code`, `created_by`
  (id de usuario, **sin llave foránea**), `created_at`. Solo guarda conteos y un código estable:
  nunca valores de celdas ni el mensaje del error de la base.
- **Permisos:** recurso `import` con `run`. owner y admin lo reciben; member nada. Se comprueba con
  `auth.api.hasPermission` (roles estáticos y dinámicos). `import:run` es además `adminAccess`: un rol
  propio con ese permiso pasa la puerta de `/admin` y llega sin ser admin.
- **Navegación:** «Importar CSV» → `/admin/import` (`area: "admin"`, visible con `import:run`).
- **Textos:** `messages.ts`, espacio `csv-import` en `es` y `en`. Las etiquetas de destinos y campos
  NO están ahí: son datos de cada destino (`string` o `{ es, en }`).
- **Entidades que cubre (`covers`):** importación / import, carga masiva / bulk import,
  importación csv / csv import.

## `contracts/` (lo único importable por otro módulo)
```ts
import { registerImportTarget } from "@/modules/csv-import/contracts"
import { z } from "zod"

registerImportTarget({
  id: "contactos",                                   // [a-z][a-z0-9_-], máx. 63
  label: { es: "Contactos", en: "Contacts" },
  description: { es: "…", en: "…" },                 // opcional
  fields: [
    { key: "name", label: { es: "Nombre", en: "Name" }, required: true },
    { key: "email", label: "Correo", type: "email", aliases: ["mail"] },
    { key: "age", label: "Edad", type: "integer", schema: z.number().min(0).max(120) },
  ],
  // Un lote (hasta 200 filas ya validadas). Escribe SOLO con ctx.db: es la transacción de todo el archivo.
  insert: async (rows, { db, userId }) => {
    await db.insertInto("contacts").values(rows.map((r) => ({ name: String(r.name), email: r.email as string | null }))).execute()
  },
})
```
Tipos de campo: `text` (por defecto, máx. 500), `email`, `integer`, `number`, `boolean` (sí/no/true/false/1/0),
`date` (`AAAA-MM-DD` o `DD/MM/AAAA`, día primero; entrega `"AAAA-MM-DD"`). Una celda vacía vale `null`
(o error `required` si el campo es obligatorio). `schema` (Zod) se aplica al valor ya convertido y puede
transformarlo. Números: acepta `1234.5`, `1234,5`, `1.234,5`, `1,234.5`; un único separador seguido de
exactamente tres dígitos es de miles (`1.234` y `1,234` valen 1234; `0.123` vale 0,123).

También exporta, puros: `parseCsv`, `parseRecords`, `detectDelimiter`, `prepareImport`, `planImport`,
`suggestMapping`, `coerceCell`, `parseNumber`, los topes (`MAX_CSV_BYTES`, `MAX_ROWS`, `MAX_COLUMNS`,
`IMPORT_BATCH_SIZE`) y `ImportError` (`code`: `empty`, `no_rows`, `too_large`, `too_many_rows`,
`too_many_columns`, `unterminated_quote`, `invalid_target`, `unknown_target`, `invalid_mapping`).

## Cómo aparece un destino (importante)
El registro vive **en memoria del proceso** (igual que `settings`): un destino sale en `/admin/import`
solo si su `registerImportTarget` ya se ejecutó en ese proceso. La página y las acciones importan
`modules/csv-import/targets.ts`, así que **registra los destinos de la app ahí** (o importa desde ahí
los archivos que los registran). El módulo no trae ningún destino a propósito: cada app decide qué
tablas se pueden cargar desde un CSV. Un destino registrado solo en un archivo que esos puntos no
cargan no aparece ni se puede ejecutar (la acción lo rechaza con `unknown_target`).

## Topes
- Tamaño: 800 000 bytes (`MAX_CSV_BYTES`), medido en bytes y comprobado en cliente y servidor. Está por
  debajo de 1 MB, el límite por defecto del cuerpo de una Server Action. **Si subes ese límite en
  `next.config` (`serverActions.bodySizeLimit`) sigue valiendo el tope de este módulo.**
- Filas de datos: 5 000 (`MAX_ROWS`); columnas: 60 (`MAX_COLUMNS`). Pasados los topes, error claro y no se lee más.
- Errores mostrados: los primeros 200; el conteo de filas con error es exacto.

## Garantías (y dónde viven)
- Cada acción de servidor (`previewImportAction`, `runImportAction`) comprueba sesión + `import:run`
  **antes** de validar la entrada con Zod, buscar el destino o tocar datos (`server/actions.ts`,
  comprobado leyendo el código en las pruebas).
- El servidor **vuelve a analizar y validar el archivo** en cada llamada; la vista previa del cliente
  no se toma como cierta. El destino debe estar registrado.
- Si hay filas con error, `runImportAction` se niega salvo que se pida omitirlas (`skipInvalid`); las
  omitidas quedan contadas en la historia.
- **Todo o nada:** todo el archivo se escribe en UNA transacción, por lotes de 200 filas, junto con la
  fila de historia. Si un lote falla se revierte todo, se registra una corrida `failed` (código
  `insert_failed`, sin valores) y la persona ve «no se guardó nada». Probado con un Kysely falso.
- Sin SQL concatenado; la tabla del módulo solo se toca con Kysely. Lo que escribe un destino es
  responsabilidad de su `insert`.

## Variables de entorno
Ninguna.

## Datos de ejemplo
`seed.ts` crea dos corridas inventadas de un destino «contactos» (una lista, una fallida), con ids
fijos (idempotente). Es solo historia para que la tabla no salga vacía: no crea ningún destino.

## Instalar
1. Copiar la carpeta a `modules/csv-import/`.
2. `pnpm modules:sync` (registros, permisos, textos y shim de `/admin/import`).
3. `pnpm db:migrate` (aplica `0114_csv_import_init` y corre el seed).
4. Registrar los destinos de la app en `modules/csv-import/targets.ts`.

## Desinstalar
Sigue «Desinstalar» en `modules/README.md`: `pnpm tsx scripts/modules.ts can-remove csv-import`, revertir
`0114_csv_import_init` (borra la historia de importaciones; los datos importados no se tocan, viven en
las tablas de cada destino) **antes** de borrar la carpeta, y `pnpm modules:sync`. Si otro código
importa `@/modules/csv-import/contracts`, se quita antes.

## Límites conocidos (v0.1)
- Registro de destinos en memoria (ver arriba): no hay descubrimiento automático.
- Solo **inserta**: no actualiza ni «upserta» registros existentes; un duplicado depende de las
  restricciones del destino (si el `insert` falla, no se guarda nada).
- Una sola transacción para todo el archivo (hasta 5 000 filas): archivos más grandes no entran.
- Sin cola ni progreso: la importación corre dentro de la petición. Sin descarga del informe de errores
  (se muestran los primeros 200 en pantalla). Sin deshacer una importación ya hecha.
- Sin Excel (`.xlsx`): solo texto CSV. Se asume UTF-8; un archivo en Latin-1 mostrará tildes rotas.
- La codificación del número con un solo separador de tres dígitos es una heurística (ver «Tipos de campo»).
- El texto del error de una celda sale en el idioma del módulo (`es`/`en` por la copia de `messages`), el
  nombre del archivo se guarda tal cual lo trae el navegador.
- Un solo ambiente y una sola organización, como el resto del template.

## Pruebas
`tests/csv-import.test.ts` (`node:test`, lógica pura, ejecutadas transpilando solo los archivos del módulo):
analizador (comillas, `""`, saltos de línea dentro de un campo, BOM, `;` `,` tab, filas de largo distinto,
archivo vacío, solo cabecera, topes de bytes/filas/columnas, comillas sin cerrar), números, conversión de
celdas por tipo, mapeo y sugerencia, plan y vista previa, registro de destinos, el almacén con un Kysely
falso (lotes, una transacción, reversión y corrida `failed` sin valores), paridad `es`/`en` con los mismos
argumentos ICU, permisos, manifiesto y, leyendo el código, las guardas de las acciones. **Sin probar contra
base**: la migración, `server/queries.ts` y el seed no se ejecutaron en ninguna base; las páginas y el
asistente no se renderizaron; el permiso real con Better Auth tampoco.

## Qué NO toca
Ningún archivo ancla ni zona protegida. De otros módulos importa solo `@/modules/i18n/contracts*`.
