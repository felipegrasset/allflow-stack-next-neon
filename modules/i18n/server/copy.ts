import { getTranslations } from "next-intl/server"

import {
  buildCopy,
  type Namespace,
  type NamespaceCopy,
  type Translate,
} from "../copy"
import { es } from "../messages"

/** Server components, Server Actions and route handlers: `const copy = await getCopy("auth")`. */
export async function getCopy<N extends Namespace>(
  namespace: N
): Promise<NamespaceCopy<N>> {
  const t = (await getTranslations(namespace)) as unknown as Translate
  return buildCopy(
    t,
    es[namespace] as Record<string, unknown>
  ) as NamespaceCopy<N>
}
