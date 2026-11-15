/**
 * The only thing another module (or the app) may import from `csv-import`:
 *
 *   import { registerImportTarget } from "@/modules/csv-import/contracts"
 *
 *   registerImportTarget({
 *     id: "contacts",
 *     label: { es: "Contactos", en: "Contacts" },
 *     fields: [
 *       { key: "name", label: { es: "Nombre", en: "Name" }, required: true },
 *       { key: "email", label: "Email", type: "email", aliases: ["correo"] },
 *     ],
 *     insert: async (rows, { db }) => { await db.insertInto("contacts").values(rows.map(...)).execute() },
 *   })
 *
 * A target appears in /admin/import only if its `registerImportTarget` ran in
 * the server process: declare yours in `modules/csv-import/targets.ts`.
 * Everything here is pure (no database, no request).
 */
export {
  IMPORT_ERROR_CODES,
  ImportError,
  isImportError,
  type ImportErrorCode,
} from "./errors"
export {
  CELL_ERROR_CODES,
  coerceCell,
  normalizeHeader,
  parseNumber,
  planImport,
  prepareImport,
  suggestMapping,
  type CellErrorCode,
  type Mapping,
  type PlanResult,
  type Prepared,
  type RowError,
} from "./plan"
export {
  DELIMITERS,
  MAX_COLUMNS,
  MAX_CSV_BYTES,
  MAX_ROWS,
  detectDelimiter,
  parseCsv,
  parseRecords,
  type Delimiter,
  type ParsedCsv,
} from "./parse"
export {
  IMPORT_BATCH_SIZE,
  findImportTarget,
  listImportTargets,
  localize,
  registerImportTarget,
  type FieldType,
  type ImportContext,
  type ImportField,
  type ImportRow,
  type ImportTarget,
  type Localized,
} from "./registry"
