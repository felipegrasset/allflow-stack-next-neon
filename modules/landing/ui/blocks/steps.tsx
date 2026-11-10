import { cn } from "@/lib/utils"

import type { CopyOf } from "../../schema"
import { Heading, Section } from "../shared"

type Props = {
  id: string
  variant: "numbered" | "timeline"
  copy: CopyOf<"steps">
}

export function StepsBlock({ id, variant, copy }: Props) {
  const timeline = variant === "timeline"
  return (
    <Section id={id} type="steps" variant={variant} tone="muted">
      <Heading id={id} className="mb-10">
        {copy.heading}
      </Heading>
      <ol
        className={cn(
          timeline
            ? "mx-auto flex max-w-2xl flex-col gap-0 border-l pl-8"
            : "grid gap-6 sm:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]"
        )}
      >
        {copy.items.map((s, i) => (
          <li
            key={s.title}
            className={cn(
              "relative flex flex-col gap-2",
              timeline
                ? "pb-8 last:pb-0"
                : "rounded-2xl border bg-card p-5 text-card-foreground"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground",
                timeline && "absolute top-0 -left-12"
              )}
            >
              {i + 1}
            </span>
            <h3 className="text-base font-semibold">{s.title}</h3>
            <p className="text-sm text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}
