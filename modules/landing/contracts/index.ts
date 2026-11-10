/** Lo único de `landing` que otro módulo puede importar. */
export const BLOCK_TYPES = [
  "hero",
  "social",
  "features",
  "steps",
  "pricing",
  "faq",
  "lead",
  "cta",
  "footer",
] as const
export type BlockType = (typeof BLOCK_TYPES)[number]

/** Una entrada de `landing.json`: qué bloque, qué variante y qué clave de copy. */
export type LandingBlockRef = {
  id: string
  type: BlockType
  variant: string
  copy: string
}
export type LandingDoc = {
  version: 1
  locale: "es" | "en"
  blocks: LandingBlockRef[]
}
