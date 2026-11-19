import { currentViewer } from "../access"
import { saveFile } from "../../contracts"
import { handleUpload } from "../handlers"

/**
 * POST /api/storage/upload — the shim lives in app/api/storage/upload/route.ts
 * (written by `pnpm modules:sync`). Public route for the proxy: the session
 * and `file:upload` are checked here.
 */
export async function POST(req: Request): Promise<Response> {
  return handleUpload(req, {
    viewer: currentViewer,
    save: saveFile,
    log: (msg, err) => console.error(msg, err),
  })
}
