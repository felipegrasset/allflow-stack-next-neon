import { APP_TITLE } from "@/lib/site"

import type { ResolvedBlock } from "../resolve"
import { CtaBlock } from "./blocks/cta"
import { FaqBlock } from "./blocks/faq"
import { FeaturesBlock } from "./blocks/features"
import { FooterBlock } from "./blocks/footer"
import { HeroBlock } from "./blocks/hero"
import { LeadBlock } from "./blocks/lead"
import { PricingBlock } from "./blocks/pricing"
import { SocialBlock } from "./blocks/social"
import { StepsBlock } from "./blocks/steps"

/** Un bloque resuelto → su componente. El `switch` es exhaustivo: un tipo nuevo no compila sin caso. */
export function RenderBlock({ block }: { block: ResolvedBlock }) {
  switch (block.type) {
    case "hero":
      return (
        <HeroBlock id={block.id} variant={block.variant} copy={block.copy} />
      )
    case "social":
      return (
        <SocialBlock id={block.id} variant={block.variant} copy={block.copy} />
      )
    case "features":
      return (
        <FeaturesBlock
          id={block.id}
          variant={block.variant}
          copy={block.copy}
        />
      )
    case "steps":
      return (
        <StepsBlock id={block.id} variant={block.variant} copy={block.copy} />
      )
    case "pricing":
      return (
        <PricingBlock id={block.id} variant={block.variant} copy={block.copy} />
      )
    case "faq":
      return (
        <FaqBlock id={block.id} variant={block.variant} copy={block.copy} />
      )
    case "lead":
      return (
        <LeadBlock id={block.id} variant={block.variant} copy={block.copy} />
      )
    case "cta":
      return (
        <CtaBlock id={block.id} variant={block.variant} copy={block.copy} />
      )
    case "footer":
      return (
        <FooterBlock id={block.id} variant={block.variant} copy={block.copy} />
      )
  }
}

/** Variables de interpolación del copy: el nombre de la app sale de `lib/site.ts`. */
export const landingVars = (year = new Date().getFullYear()) => ({
  app: APP_TITLE,
  year: String(year),
})

export function Landing({ blocks }: { blocks: ResolvedBlock[] }) {
  // El pie va fuera de <main>: es el `contentinfo` de la página.
  const body = blocks.filter((b) => b.type !== "footer")
  const footers = blocks.filter((b) => b.type === "footer")
  return (
    <>
      <main id="contenido">
        {body.map((b) => (
          <RenderBlock key={b.id} block={b} />
        ))}
      </main>
      {footers.map((b) => (
        <RenderBlock key={b.id} block={b} />
      ))}
    </>
  )
}
