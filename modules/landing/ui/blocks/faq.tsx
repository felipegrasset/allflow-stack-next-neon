import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"

import type { CopyOf } from "../../schema"
import { Heading, Section } from "../shared"

type Props = {
  id: string
  variant: "accordion" | "columns"
  copy: CopyOf<"faq">
}

/** `<details>`: funciona sin JavaScript y con teclado de fábrica. */
export function FaqBlock({ id, variant, copy }: Props) {
  const columns = variant === "columns"
  return (
    <Section id={id} type="faq" variant={variant} tone="muted">
      <div
        className={cn(
          columns ? "grid gap-10 lg:grid-cols-[1fr_2fr]" : "mx-auto max-w-3xl"
        )}
      >
        <Heading id={id} className="mb-8 lg:mb-0">
          {copy.heading}
        </Heading>
        {columns ? (
          <dl className="grid gap-6 sm:grid-cols-2">
            {copy.items.map((it) => (
              <div key={it.q} className="flex flex-col gap-1.5">
                <dt className="font-semibold">{it.q}</dt>
                <dd className="text-sm text-muted-foreground">{it.a}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="flex flex-col divide-y rounded-2xl border bg-card text-card-foreground">
            {copy.items.map((it) => (
              <details key={it.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {it.q}
                  <Plus
                    className="size-4 shrink-0 transition-transform group-open:rotate-45"
                    aria-hidden
                  />
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{it.a}</p>
              </details>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}
