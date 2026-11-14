/**
 * Shared by contracts/server.ts and contracts/client.ts: the namespace of a
 * module's catalog and the type of its copy object. Pure.
 */
import type { Copy } from "../copy"

/** A module's source catalog (`es` of its `messages` entrypoint): one top-level key, its id. */
export type ModuleSourceCatalog = Record<string, Record<string, unknown>>

/** The copy object of a module's namespace: strings, and functions for messages with ICU arguments. */
export type ModuleCopy<E extends ModuleSourceCatalog> = Copy<E[keyof E]>

export function moduleNamespace(es: ModuleSourceCatalog): string {
  const keys = Object.keys(es)
  if (keys.length !== 1)
    throw new Error(
      `i18n: a module catalog has exactly one top-level key (its id); got ${keys.join(", ") || "none"}`
    )
  return keys[0]
}
