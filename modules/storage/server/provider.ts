import {
  StorageNotConfiguredError,
  type StorageProvider,
} from "../contracts/types"
import { memoryProvider } from "./providers/memory"
import { vercelBlobProvider, type BlobAccess } from "./providers/vercel-blob"

export type Env = Record<string, string | undefined>

const g = globalThis as unknown as { __storageMemory?: StorageProvider }

export function blobAccess(env: Env = process.env): BlobAccess {
  return env.STORAGE_BLOB_ACCESS?.trim() === "public" ? "public" : "private"
}

/**
 * The provider that stores NEW files: Vercel Blob with BLOB_READ_WRITE_TOKEN;
 * without it, the in-memory one outside production, and an error in
 * production (never a silent memory store in a deployed app).
 */
export function currentProvider(env: Env = process.env): StorageProvider {
  const token = env.BLOB_READ_WRITE_TOKEN?.trim()
  if (token) return vercelBlobProvider({ token, access: blobAccess(env) })
  if (env.NODE_ENV === "production") throw new StorageNotConfiguredError()
  g.__storageMemory ??= memoryProvider()
  return g.__storageMemory
}

/** The provider that stored a file (`storage_files.provider`), to read or delete it. */
export function providerByName(
  name: string,
  env: Env = process.env
): StorageProvider {
  if (name === "memory") {
    g.__storageMemory ??= memoryProvider()
    return g.__storageMemory
  }
  if (name === "vercel-blob") {
    const token = env.BLOB_READ_WRITE_TOKEN?.trim()
    if (!token) throw new StorageNotConfiguredError()
    return vercelBlobProvider({ token, access: blobAccess(env) })
  }
  throw new Error(`storage: proveedor desconocido «${name}»`)
}
