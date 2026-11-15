/**
 * What another module (or the app) imports from `export`, on the server.
 * The button is in `./export-button`.
 *
 *   import { registerExport } from "@/modules/export/contracts"
 *
 *   registerExport({
 *     id: "tickets",
 *     permission: { ticket: ["manage"] },
 *     query: async () => ({
 *       rows: await listAllTickets(),
 *       columns: [{ header: "Asunto", key: "subject" }, { header: "Estado", key: "status" }],
 *     }),
 *   })
 *
 * Read modules/export/MODULE.md, «Registrar un destino», before relying on the
 * registry in a deployed app: the registering file has to be loaded by the
 * process that serves the route.
 */
export * from "./csv"
export {
  DEFAULT_MAX_ROWS,
  registerExport,
  type ExportContext,
  type ExportData,
  type ExportDestination,
} from "../server/registry"
export { exportGet } from "../server/wire"
