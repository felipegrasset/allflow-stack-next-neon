"use client"

/**
 * Text of a module's own catalog, in a client component. Same shape as
 * `getModuleCopy` (contracts/server.ts); needs the provider of app/layout.tsx,
 * which already carries every installed module's catalog.
 *
 *   import { es } from "../messages"
 *   const copy = useModuleCopy(es)
 */
import { useTranslations } from "next-intl"
import { useMemo } from "react"

import { buildCopy, type Translate } from "../copy"
import {
  moduleNamespace,
  type ModuleCopy,
  type ModuleSourceCatalog,
} from "./namespace"

export type { ModuleCopy, ModuleSourceCatalog }

export function useModuleCopy<E extends ModuleSourceCatalog>(
  es: E
): ModuleCopy<E> {
  const ns = moduleNamespace(es)
  const t = useTranslations(ns) as unknown as Translate
  return useMemo(() => buildCopy(t, es[ns]) as ModuleCopy<E>, [t, es, ns])
}
