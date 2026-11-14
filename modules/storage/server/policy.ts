/**
 * Pure rules of the module: who may open or delete a file, how a name is
 * cleaned, how a stored object is named. No I/O, so tests run them directly.
 */
import type { AllowedType, StorageFile, Visibility } from "../contracts/types"
import { EXTENSIONS } from "./sniff"

export type FileAction = "upload" | "read" | "delete"

/** The person asking, as the route sees them. */
export type Viewer = {
  id: string
  /** admin or owner of the app's organization. */
  isAdmin: boolean
  /** Their role grants `file:<action>` (Better Auth access control). */
  can: (action: FileAction) => Promise<boolean>
}

type FileFacts = Pick<StorageFile, "ownerId" | "visibility">

/** May `viewer` (null = no session) open the file? */
export async function canRead(
  file: FileFacts,
  viewer: Viewer | null
): Promise<boolean> {
  if (file.visibility === "public") return true
  if (!viewer) return false
  if (!(await viewer.can("read"))) return false
  if (file.visibility === "members") return true
  return file.ownerId === viewer.id || viewer.isAdmin
}

/** May `viewer` delete the file? The owner, or an admin, and always with `file:delete`. */
export async function canDelete(
  file: FileFacts,
  viewer: Viewer | null
): Promise<boolean> {
  if (!viewer) return false
  if (!(await viewer.can("delete"))) return false
  return file.ownerId === viewer.id || viewer.isAdmin
}

/**
 * A display name: no path, no control characters, no quotes, at most 200
 * characters. Never used to build the provider key.
 */
export function cleanFileName(raw: string, fallback = "archivo"): string {
  const base = raw.split(/[\\/]/).pop() ?? ""
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : fallback
}

/** The object's path in the provider: our id and the sniffed extension, never the user's name. */
export function objectPath(id: string, type: AllowedType): string {
  return `storage/${id}.${EXTENSIONS[type]}`
}

/** Path of the route that serves a file. */
export function fileUrl(id: string): string {
  return `/api/storage/${encodeURIComponent(id)}`
}

/** Ids are UUIDs (crypto.randomUUID). Anything else is a 404 without touching the database. */
export const FILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** `Content-Disposition` with an ASCII fallback and the UTF-8 name (RFC 6266 / 5987). */
export function contentDisposition(
  name: string,
  kind: "inline" | "attachment"
): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/[\\"]/g, "_")
  const utf8 = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${utf8}`
}

export function isVisibility(v: unknown): v is Visibility {
  return v === "private" || v === "members" || v === "public"
}
