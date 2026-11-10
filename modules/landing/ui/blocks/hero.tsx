import { ButtonLink } from "@/components/button-link"
import { cn } from "@/lib/utils"

import type { CopyOf } from "../../schema"
import { Heading, Section } from "../shared"

type Props = {
  id: string
  variant: "split" | "centered"
  copy: CopyOf<"hero">
}

/** La maqueta de la app: el hero muestra el resultado, no solo lo promete. Solo tokens. */
function Mock({ mock }: { mock: NonNullable<CopyOf<"hero">["mock"]> }) {
  return (
    <div
      aria-hidden
      className="lnd-in-2 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5"
    >
      <div className="mb-4 flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="ml-2 text-xs font-medium text-muted-foreground">
          {mock.title}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {mock.rows.map((r) => (
          <li
            key={r.label}
            className="flex items-center justify-between rounded-lg bg-muted px-3 py-2.5 text-sm"
          >
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-semibold">{r.value}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full w-4/5 rounded-full bg-primary" />
      </div>
    </div>
  )
}

export function HeroBlock({ id, variant, copy }: Props) {
  const centered = variant === "centered"
  return (
    <Section
      id={id}
      type="hero"
      variant={variant}
      className="pt-12 pb-16 sm:pt-20 sm:pb-24"
    >
      <div
        className={cn(
          centered
            ? "mx-auto flex max-w-3xl flex-col items-center text-center"
            : "grid items-center gap-10 lg:grid-cols-2 lg:gap-14"
        )}
      >
        <div
          className={cn(
            "lnd-in flex flex-col gap-5",
            centered && "items-center"
          )}
        >
          {copy.eyebrow && (
            <p className="w-fit rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {copy.eyebrow}
            </p>
          )}
          <Heading id={id} as="h1" className="text-4xl sm:text-5xl">
            {copy.title}
          </Heading>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground">
            {copy.subtitle}
          </p>
          <div
            className={cn("flex flex-wrap gap-3", centered && "justify-center")}
          >
            <ButtonLink href={copy.primary.href} size="lg">
              {copy.primary.label}
            </ButtonLink>
            {copy.secondary && (
              <ButtonLink
                href={copy.secondary.href}
                size="lg"
                variant="outline"
              >
                {copy.secondary.label}
              </ButtonLink>
            )}
          </div>
        </div>
        {!centered && copy.mock && <Mock mock={copy.mock} />}
      </div>
    </Section>
  )
}
