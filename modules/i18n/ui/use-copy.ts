"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"

import {
  buildCopy,
  type Namespace,
  type NamespaceCopy,
  type Translate,
} from "../copy"
import { es } from "../messages"

/** Client components: `const copy = useCopy("auth")`. Needs the provider in app/layout.tsx. */
export function useCopy<N extends Namespace>(namespace: N): NamespaceCopy<N> {
  const t = useTranslations(namespace) as unknown as Translate
  return useMemo(
    () =>
      buildCopy(
        t,
        es[namespace] as Record<string, unknown>
      ) as NamespaceCopy<N>,
    [t, namespace]
  )
}
