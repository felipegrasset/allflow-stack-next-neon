/**
 * Types, constants and errors of `storage`. Pure: no server or client APIs, so
 * a server action, a client component and a test can all import it.
 */

/** Who may open a file through GET /api/storage/[id]. */
export const VISIBILITIES = ["private", "members", "public"] as const
/**
 * - `private`: the owner, and admins/owners of the app's organization (with `file:read`).
 * - `members`: anyone signed in with `file:read` (attachments of shared entities).
 * - `public`:  anyone, without a session (avatars, product photos).
 */
export type Visibility = (typeof VISIBILITIES)[number]

/** Types the module accepts. Each one is recognised by its magic bytes (server/sniff.ts). */
export const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const
export type AllowedType = (typeof ALLOWED_TYPES)[number]

/**
 * 4 MB. A Vercel function accepts a request body of 4.5 MB at most, and the
 * upload goes through the route handler, so a larger default would fail at
 * the platform with an opaque 413.
 */
export const DEFAULT_MAX_BYTES = 4 * 1024 * 1024

/** A stored file, as the module hands it out. Never carries the provider key. */
export type StorageFile = {
  id: string
  ownerId: string | null
  name: string
  contentType: AllowedType
  size: number
  visibility: Visibility
  entity: string | null
  entityId: string | null
  createdAt: Date
  /** Where to open it: "/api/storage/<id>" (checks permission on every request). */
  url: string
}

/** The JSON a browser receives from the upload route (dates as strings). */
export type UploadedFile = Omit<StorageFile, "createdAt" | "ownerId"> & {
  createdAt: string
}

/** `error` field of a failed upload response; `messages.ts` has a text for each. */
export const UPLOAD_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "too_large",
  "unsupported_type",
  "empty",
  "bad_request",
  "not_configured",
  "upload_failed",
] as const
export type UploadErrorCode = (typeof UPLOAD_ERROR_CODES)[number]

export type SaveFileInput = {
  /** The bytes. The type is sniffed from them; a browser-declared type is ignored. */
  data: Uint8Array | ArrayBuffer
  /** Original file name, only for display and Content-Disposition. Sanitised. */
  name: string
  /** `"user".id` of the owner, or null for a file the app owns. */
  ownerId: string | null
  visibility?: Visibility
  /** Link to an entity of another module, e.g. `{ entity: "ticket", entityId: "t_42" }`. */
  entity?: string
  entityId?: string
  /** Subset of ALLOWED_TYPES to accept (default: all of them). */
  allowedTypes?: readonly AllowedType[]
  /** Size limit in bytes (default DEFAULT_MAX_BYTES). */
  maxBytes?: number
}

/**
 * Where the bytes live. `key` is opaque to the module: whatever `put` returned
 * is stored in `storage_files.provider_key` and handed back to `get`/`delete`.
 */
export interface StorageProvider {
  /** Saved in `storage_files.provider`; a file is always served by the provider that stored it. */
  readonly name: string
  put(
    pathname: string,
    data: Uint8Array,
    opts: { contentType: string }
  ): Promise<{ key: string }>
  /** null when the object does not exist. */
  get(key: string): Promise<{ body: ReadableStream<Uint8Array> } | null>
  /** Idempotent: deleting a missing object is not an error. */
  delete(key: string): Promise<void>
  /** A direct, world-readable URL for the object, or null if it needs credentials. */
  publicUrl(key: string): string | null
}

export class StorageError extends Error {
  constructor(
    readonly code: UploadErrorCode,
    detail: string
  ) {
    super(detail)
    this.name = "StorageError"
  }
}
export class FileTooLargeError extends StorageError {
  constructor(size: number, max: number) {
    super("too_large", `El archivo pesa ${size} bytes; el máximo es ${max}`)
  }
}
export class EmptyFileError extends StorageError {
  constructor() {
    super("empty", "El archivo está vacío")
  }
}
export class UnsupportedTypeError extends StorageError {
  constructor(detected: string | null) {
    super(
      "unsupported_type",
      `Tipo de archivo no admitido (detectado: ${detected ?? "desconocido"})`
    )
  }
}
export class StorageNotConfiguredError extends StorageError {
  constructor() {
    super(
      "not_configured",
      "Falta BLOB_READ_WRITE_TOKEN: el almacenamiento no está configurado"
    )
  }
}
/** The provider answered with an error (or not at all). */
export class StorageProviderError extends StorageError {
  constructor(
    readonly provider: string,
    readonly status: number,
    detail: string
  ) {
    super("upload_failed", `${provider} respondió ${status}: ${detail}`)
  }
}
