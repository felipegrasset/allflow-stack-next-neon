/**
 * Vercel Blob over plain `fetch` (the template does not ship `@vercel/blob`).
 * Mirrors what @vercel/blob 2.8 sends: API at https://vercel.com/api/blob,
 * `x-api-version: 12`, Bearer token, the store id (4th `_` segment of the
 * token) in `x-vercel-blob-store-id`, put options as `x-*` headers.
 *
 * Differences with the SDK, on purpose: no retries, no multipart (files are
 * at most a few MB), no OIDC tokens.
 */
import {
  StorageProviderError,
  type StorageProvider,
} from "../../contracts/types"

export const VERCEL_BLOB_API = "https://vercel.com/api/blob"
const API_VERSION = "12"

export type BlobAccess = "public" | "private"

export type VercelBlobOptions = {
  token: string
  /** Must match how the store was created. */
  access: BlobAccess
  apiUrl?: string
  fetch?: typeof fetch
}

export function storeIdFromToken(token: string): string {
  return token.split("_")[3] ?? ""
}

/** Only URLs of a Vercel Blob store are ever fetched with the token. */
export function isBlobUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return (
      u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com")
    )
  } catch {
    return false
  }
}

async function errorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string }
    }
    return [body.error?.code, body.error?.message].filter(Boolean).join(": ")
  } catch {
    return res.statusText
  }
}

export function vercelBlobProvider(opts: VercelBlobOptions): StorageProvider {
  const doFetch = opts.fetch ?? fetch
  const api = (opts.apiUrl ?? VERCEL_BLOB_API).replace(/\/+$/, "")
  const storeId = storeIdFromToken(opts.token)
  const base = {
    authorization: `Bearer ${opts.token}`,
    "x-api-version": API_VERSION,
    "x-vercel-blob-store-id": storeId,
  }

  return {
    name: "vercel-blob",

    async put(pathname, data, { contentType }) {
      const params = new URLSearchParams({ pathname })
      const res = await doFetch(`${api}/?${params.toString()}`, {
        method: "PUT",
        body: new Blob([new Uint8Array(data)]),
        headers: {
          ...base,
          "x-vercel-blob-access": opts.access,
          "x-content-type": contentType,
          "x-add-random-suffix": "1",
          "x-allow-overwrite": "0",
          "x-content-length": String(data.byteLength),
        },
      })
      if (!res.ok) {
        throw new StorageProviderError(
          "vercel-blob",
          res.status,
          await errorDetail(res)
        )
      }
      const body = (await res.json()) as { url?: unknown }
      if (typeof body.url !== "string" || !isBlobUrl(body.url)) {
        throw new StorageProviderError(
          "vercel-blob",
          res.status,
          "respuesta sin url de blob"
        )
      }
      return { key: body.url }
    },

    async get(key) {
      if (!isBlobUrl(key)) return null
      const res = await doFetch(key, {
        method: "GET",
        headers: opts.access === "private" ? { authorization: base.authorization } : {},
      })
      if (res.status === 404) return null
      if (!res.ok || !res.body) {
        throw new StorageProviderError("vercel-blob", res.status, res.statusText)
      }
      return { body: res.body }
    },

    async delete(key) {
      if (!isBlobUrl(key)) return
      const res = await doFetch(`${api}/delete`, {
        method: "POST",
        headers: { ...base, "content-type": "application/json" },
        body: JSON.stringify({ urls: [key] }),
      })
      if (!res.ok && res.status !== 404) {
        throw new StorageProviderError(
          "vercel-blob",
          res.status,
          await errorDetail(res)
        )
      }
    },

    publicUrl(key) {
      return opts.access === "public" && isBlobUrl(key) ? key : null
    },
  }
}
