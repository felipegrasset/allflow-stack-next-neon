/**
 * Where the app lists its import targets. A target appears in /admin/import
 * only if its `registerImportTarget` has run in the server process, and the
 * page and the actions import THIS file: call `registerImportTarget` here (or
 * import the files that do). No target ships with the module on purpose: each
 * app decides which of its tables may be loaded from a CSV.
 *
 * Example (kept as a comment so nothing writes to a table that may not exist):
 *
 *   import { registerImportTarget } from "./contracts/registry"
 *
 *   registerImportTarget({
 *     id: "contactos",
 *     label: { es: "Contactos", en: "Contacts" },
 *     fields: [
 *       { key: "name", label: { es: "Nombre", en: "Name" }, required: true },
 *       { key: "email", label: { es: "Correo", en: "Email" }, type: "email" },
 *     ],
 *     insert: async (rows, { db }) => {
 *       await db.insertInto("contacts").values(rows.map((r) => ({ name: String(r.name), email: (r.email as string | null) }))).execute()
 *     },
 *   })
 */
export {}
