import { getKysely } from "@/server/db/pool"

import { currentViewer } from "../access"
import { getFileRow, toFile } from "../files"
import { handleServe } from "../handlers"
import { providerByName } from "../provider"

/**
 * GET /api/storage/<id> — the shim lives in app/api/storage/[id]/route.ts.
 * Checks the viewer against the file's visibility on every request.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await ctx.params
  return handleServe(id, req, {
    viewer: currentViewer,
    find: async (fileId) => {
      const row = await getFileRow({ db: getKysely() }, fileId)
      return row
        ? { file: toFile(row), provider: row.provider, key: row.provider_key }
        : null
    },
    providerFor: (name) => providerByName(name),
    log: (msg, err) => console.error(msg, err),
  })
}
