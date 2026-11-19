/**
 * What another module (or the app) may import from `reports`:
 *
 *   import { defineDashboard, saveDashboard } from "@/modules/reports/contracts"
 *
 *   export const sales = defineDashboard({ id: "ventas", title: "Ventas", sources: {…}, cards: […] })
 *   await saveDashboard(sales, { db })          // in a seed: idempotent
 *
 * `defineDashboard` and the types are pure. `saveDashboard` is server-only.
 */
export {
  COLUMN_TYPES,
  DENIED_COLUMN,
  DENIED_TABLES,
  FILTER_OPS,
  INTERVALS,
  cardSchema,
  dashboardSchema,
  defineDashboard,
  resolveText,
  type Card,
  type CardKind,
  type ColumnType,
  type Dashboard,
  type DashboardInput,
  type Filter,
  type FilterOp,
  type Interval,
  type LocalizedText,
  type Metric,
  type Source,
} from "./definition"
export { saveDashboard, type SaveDashboardOptions } from "../server/save"
