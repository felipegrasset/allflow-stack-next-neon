import type { CopyOf } from "../../schema"
import { Section } from "../shared"

type Props = { id: string; variant: "logos" | "stats"; copy: CopyOf<"social"> }

/** Va pegado bajo el hero (patrón de logos/cifras de las fichas): poco aire arriba. */
export function SocialBlock({ id, variant, copy }: Props) {
  return (
    <Section
      id={id}
      type="social"
      variant={variant}
      tone="muted"
      labelled={Boolean(copy.heading)}
      className="py-10 sm:py-12"
    >
      {copy.heading && (
        <h2
          id={`${id}-title`}
          className="mb-6 text-center text-sm font-medium text-muted-foreground"
        >
          {copy.heading}
        </h2>
      )}
      {variant === "logos" ? (
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {(copy.logos ?? []).map((name) => (
            <li
              key={name}
              className="font-heading text-lg font-semibold text-muted-foreground"
            >
              {name}
            </li>
          ))}
        </ul>
      ) : (
        <dl className="grid gap-6 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
          {(copy.stats ?? []).map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-1 text-center"
            >
              <dt className="order-2 text-sm text-muted-foreground">
                {s.label}
              </dt>
              <dd className="font-heading text-3xl font-semibold">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Section>
  )
}
