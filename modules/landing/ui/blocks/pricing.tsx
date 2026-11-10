import { Check } from "lucide-react"

import { ButtonLink } from "@/components/button-link"
import { cn } from "@/lib/utils"

import type { CopyOf } from "../../schema"
import { Heading, Section } from "../shared"

type Props = { id: string; variant: "cards" | "list"; copy: CopyOf<"pricing"> }

export function PricingBlock({ id, variant, copy }: Props) {
  const list = variant === "list"
  return (
    <Section id={id} type="pricing" variant={variant}>
      <div className="mb-10 flex max-w-2xl flex-col gap-3">
        <Heading id={id}>{copy.heading}</Heading>
        {copy.intro && (
          <p className="text-lg text-muted-foreground">{copy.intro}</p>
        )}
      </div>
      <ul
        className={cn(
          list
            ? "mx-auto flex max-w-3xl flex-col gap-3"
            : "grid auto-rows-fr gap-4 sm:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]"
        )}
      >
        {copy.plans.map((p) => (
          <li
            key={p.name}
            data-highlighted={p.highlighted ? "true" : undefined}
            className={cn(
              "flex gap-4 rounded-2xl border bg-card p-5 text-card-foreground",
              list
                ? "flex-col sm:flex-row sm:items-center sm:justify-between"
                : "flex-col",
              p.highlighted && "border-primary ring-2 ring-primary/30"
            )}
          >
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold">{p.name}</h3>
              {p.description && (
                <p className="text-sm text-muted-foreground">{p.description}</p>
              )}
              <p className="mt-2 flex items-baseline gap-1">
                <span className="font-heading text-3xl font-semibold">
                  {p.price}
                </span>
                {p.period && (
                  <span className="text-sm text-muted-foreground">
                    {p.period}
                  </span>
                )}
              </p>
            </div>
            <ul
              className={cn("flex flex-col gap-1.5 text-sm", !list && "flex-1")}
            >
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  {f}
                </li>
              ))}
            </ul>
            <ButtonLink
              href={p.cta.href}
              variant={p.highlighted ? "default" : "outline"}
            >
              {p.cta.label}
            </ButtonLink>
          </li>
        ))}
      </ul>
    </Section>
  )
}
