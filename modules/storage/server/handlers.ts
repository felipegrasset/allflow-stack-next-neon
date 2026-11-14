/**
 * The two HTTP handlers, with every dependency injected so the tests can run
 * them without Next, Better Auth or a database. The route files
 * (server/upload/route.ts, server/file/route.ts) wire the real ones.
 */
import {
  DEFAULT_MAX_BYTES,
  StorageError,
  type SaveFileInput,
  type StorageFile,
  type StorageProvider,
  type UploadErrorCode,
  type UploadedFile,
} from "../contracts/types"
import {
  canRead,
  contentDisposition,
  FILE_ID,
  isVisibility,
  type Viewer,
} from "./policy"

/** Room for the multipart boundaries and the other fields. */
const MULTIPART_OVERHEAD = 64 * 1024

const STATUS: Record<UploadErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  too_large: 413,
  unsupported_type: 415,
  empty: 400,
  bad_request: 400,
  not_configured: 503,
  upload_failed: 502,
}

export function errorResponse(code: UploadErrorCode): Response {
  return Response.json(
    { error: code },
    { status: STATUS[code], headers: { "cache-control": "no-store" } }
  )
}

export function toUploaded(f: StorageFile): UploadedFile {
  return {
    id: f.id,
    name: f.name,
    contentType: f.contentType,
    size: f.size,
    visibility: f.visibility,
    entity: f.entity,
    entityId: f.entityId,
    createdAt: f.createdAt.toISOString(),
    url: f.url,
  }
}

export type UploadDeps = {
  viewer: () => Promise<Viewer | null>
  save: (input: SaveFileInput) => Promise<StorageFile>
  maxBytes?: number
  log?: (msg: string, err: unknown) => void
}

/**
 * POST multipart/form-data with `file` and, optionally, `visibility`
 * (private | members | public; default private). The file is created
 * unattached and owned by the uploader: the module that uses it links it with
 * `attachFile` from its own server action, after checking its own permission.
 * 201 `{ file }`, or `{ error: UploadErrorCode }`.
 */
export async function handleUpload(
  req: Request,
  deps: UploadDeps
): Promise<Response> {
  const max = deps.maxBytes ?? DEFAULT_MAX_BYTES
  const viewer = await deps.viewer()
  if (!viewer) return errorResponse("unauthorized")
  if (!(await viewer.can("upload"))) return errorResponse("forbidden")

  const declared = Number(req.headers.get("content-length") ?? "")
  if (Number.isFinite(declared) && declared > max + MULTIPART_OVERHEAD)
    return errorResponse("too_large")
  if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data"))
    return errorResponse("bad_request")

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return errorResponse("bad_request")
  }
  const file = form.get("file")
  if (!file || typeof file === "string") return errorResponse("bad_request")
  if (file.size > max) return errorResponse("too_large")
  const rawVisibility = form.get("visibility") ?? "private"
  if (!isVisibility(rawVisibility)) return errorResponse("bad_request")

  try {
    const saved = await deps.save({
      data: new Uint8Array(await file.arrayBuffer()),
      name: file.name,
      ownerId: viewer.id,
      visibility: rawVisibility,
      maxBytes: max,
    })
    return Response.json(
      { file: toUploaded(saved) },
      { status: 201, headers: { "cache-control": "no-store" } }
    )
  } catch (err) {
    if (err instanceof StorageError) {
      if (err.code === "upload_failed" || err.code === "not_configured")
        deps.log?.("storage: upload failed", err)
      return errorResponse(err.code)
    }
    deps.log?.("storage: upload failed", err)
    return errorResponse("upload_failed")
  }
}

export type ServeDeps = {
  viewer: () => Promise<Viewer | null>
  find: (id: string) => Promise<{
    file: StorageFile
    provider: string
    key: string
  } | null>
  providerFor: (name: string) => StorageProvider
  log?: (msg: string, err: unknown) => void
}

const notFound = () =>
  new Response(null, { status: 404, headers: { "cache-control": "no-store" } })

/**
 * GET /api/storage/<id>[?download=1]. A file the viewer may not open answers
 * 404, the same as a missing one (no hint that it exists). Public files in a
 * public store redirect to the provider's URL; everything else is streamed, so
 * the provider URL of a non-public file never leaves the server.
 */
export async function handleServe(
  id: string,
  req: Request,
  deps: ServeDeps
): Promise<Response> {
  if (!FILE_ID.test(id)) return notFound()
  const found = await deps.find(id)
  if (!found) return notFound()
  const { file } = found
  // A public file needs no session lookup.
  const viewer = file.visibility === "public" ? null : await deps.viewer()
  if (!(await canRead(file, viewer))) return notFound()

  const download = new URL(req.url).searchParams.get("download") === "1"
  let provider: StorageProvider
  try {
    provider = deps.providerFor(found.provider)
  } catch (err) {
    deps.log?.("storage: provider unavailable", err)
    return new Response(null, { status: 503 })
  }

  const direct = file.visibility === "public" ? provider.publicUrl(found.key) : null
  if (direct && !download) {
    return new Response(null, {
      status: 302,
      headers: { location: direct, "cache-control": "public, max-age=300" },
    })
  }

  let object: Awaited<ReturnType<StorageProvider["get"]>>
  try {
    object = await provider.get(found.key)
  } catch (err) {
    deps.log?.("storage: read failed", err)
    return new Response(null, { status: 502 })
  }
  if (!object) return notFound()
  return new Response(object.body, {
    status: 200,
    headers: {
      "content-type": file.contentType,
      "content-length": String(file.size),
      "content-disposition": contentDisposition(
        file.name,
        download ? "attachment" : "inline"
      ),
      "x-content-type-options": "nosniff",
      "cache-control":
        file.visibility === "public"
          ? "public, max-age=300"
          : "private, no-store",
    },
  })
}
