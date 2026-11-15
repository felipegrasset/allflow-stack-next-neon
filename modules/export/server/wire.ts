/** The real dependencies of the export handler (Better Auth session and permissions). */
import { can } from "@/server/module-access"
import { getSession } from "@/server/session"

import { handleExport, type ExportDeps } from "./handler"
import { findExport, type ExportDestination } from "./registry"

export const realDeps = (): ExportDeps => ({
  session: async () => {
    const session = await getSession()
    return session ? { userId: session.user.id } : null
  },
  can,
  find: findExport,
  log: (msg, err) => console.error(msg, err),
})

/** A GET handler bound to one destination, for a module that serves its own route. */
export function exportGet(destination: ExportDestination<unknown>) {
  return (req: Request): Promise<Response> =>
    handleExport(destination.id, req, { ...realDeps(), find: () => destination })
}
