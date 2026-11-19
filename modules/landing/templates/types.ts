import type { LandingDoc } from "../contracts"
import type { CopySets } from "../schema"

/** Una plantilla de arquetipo: una combinación de bloques y su copy base en `es` y `en`. */
export type LandingTemplate = {
  id: string
  /** Para qué arquetipo de app sirve. */
  archetype: string
  landing: LandingDoc
  copy: CopySets
}

/** Atajo para escribir la lista de bloques: `b("hero", "split")` usa el id y la clave `hero`. */
export const b = (type: string, variant: string, id = type) => ({
  id,
  type,
  variant,
  copy: id,
})
