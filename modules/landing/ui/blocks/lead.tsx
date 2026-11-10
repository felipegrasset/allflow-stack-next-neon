import type { CopyOf } from "../../schema"
import { LeadForm } from "../lead-form"
import { Heading, Section } from "../shared"

type Props = { id: string; variant: "card" | "inline"; copy: CopyOf<"lead"> }

/** El formulario entrega el lead al CRM por la llave de ingesta (server/lead.ts). */
export function LeadBlock({ id, variant, copy }: Props) {
  const inline = variant === "inline"
  return (
    <Section id={id} type="lead" variant={variant}>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <Heading id={id}>{copy.heading}</Heading>
          {copy.subtitle && (
            <p className="text-lg text-muted-foreground">{copy.subtitle}</p>
          )}
        </div>
        <div
          className={
            inline
              ? ""
              : "rounded-2xl border bg-card p-5 text-card-foreground sm:p-6"
          }
        >
          <LeadForm
            id={id}
            variant={variant}
            copy={copy}
            turnstileSiteKey={
              process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined
            }
          />
        </div>
      </div>
    </Section>
  )
}
