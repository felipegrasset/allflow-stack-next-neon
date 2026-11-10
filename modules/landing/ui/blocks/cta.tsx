import { ButtonLink } from "@/components/button-link"
import { cn } from "@/lib/utils"

import type { CopyOf } from "../../schema"
import { Heading, Section } from "../shared"

type Props = { id: string; variant: "band" | "split"; copy: CopyOf<"cta"> }

/** Franja contrastada: usa `bg-primary` / `text-primary-foreground`, el par con contraste garantizado. */
export function CtaBlock({ id, variant, copy }: Props) {
  const split = variant === "split"
  return (
    <Section id={id} type="cta" variant={variant} tone="brand">
      <div
        className={cn(
          "flex flex-col gap-6",
          split
            ? "md:flex-row md:items-center md:justify-between"
            : "items-center text-center"
        )}
      >
        <div
          className={cn(
            "flex max-w-2xl flex-col gap-2",
            !split && "items-center"
          )}
        >
          <Heading id={id}>{copy.title}</Heading>
          {copy.subtitle && (
            <p className="text-lg opacity-90">{copy.subtitle}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={copy.primary.href} size="lg" variant="secondary">
            {copy.primary.label}
          </ButtonLink>
          {copy.secondary && (
            <ButtonLink
              href={copy.secondary.href}
              size="lg"
              variant="ghost"
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              {copy.secondary.label}
            </ButtonLink>
          )}
        </div>
      </div>
    </Section>
  )
}
