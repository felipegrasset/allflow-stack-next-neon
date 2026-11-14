import type { StorageProvider } from "../../contracts/types"

/**
 * Bytes in a Map: for tests, and for local development without a Blob token.
 * Lost when the process restarts (the rows stay; their files then answer 404).
 */
export function memoryProvider(
  store: Map<string, { data: Uint8Array; contentType: string }> = new Map()
): StorageProvider & { readonly size: number } {
  return {
    name: "memory",
    get size() {
      return store.size
    },
    async put(pathname, data, { contentType }) {
      const key = `memory:${pathname}`
      if (store.has(key)) throw new Error(`memory: ${key} ya existe`)
      store.set(key, { data: new Uint8Array(data), contentType })
      return { key }
    },
    async get(key) {
      const hit = store.get(key)
      if (!hit) return null
      const data = hit.data
      return {
        body: new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(data)
            c.close()
          },
        }),
      }
    },
    async delete(key) {
      store.delete(key)
    },
    publicUrl() {
      return null
    },
  }
}
