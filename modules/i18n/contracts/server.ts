/**
 * Text of a module's own catalog, on the server (pages, layouts, header slots,
 * Server Actions, route handlers). Part of i18n's public face: another module
 * imports it as `@/modules/i18n/contracts/server`.
 *
 *   import { es } from "../messages"            // the module's `messages` entrypoint
 *   const copy = await getModuleCopy(es)
 *   copy.title                                  // "Pings" | "Pings"
 *   copy.header.count(3)                        // one positional parameter per ICU argument
 *
 * `es` only supplies the keys and the argument names (and the namespace: its
 * one top-level key, the module id); the text comes from the active locale's
 * catalog, which modules/i18n/request.ts builds with every installed module's.
 */
import { getTranslations } from "next-intl/server"

import { buildCopy, type Translate } from "../copy"
import {
  moduleNamespace,
  type ModuleCopy,
  type ModuleSourceCatalog,
} from "./namespace"

export type { ModuleCopy, ModuleSourceCatalog }

export async function getModuleCopy<E extends ModuleSourceCatalog>(
  es: E
): Promise<ModuleCopy<E>> {
  const ns = moduleNamespace(es)
  const t = (await getTranslations(ns)) as unknown as Translate
  return buildCopy(t, es[ns]) as ModuleCopy<E>
}
