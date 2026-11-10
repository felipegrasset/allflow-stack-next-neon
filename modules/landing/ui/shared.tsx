import { cn } from "@/lib/utils"

/**
 * Envoltura común de un bloque. `data-block` / `data-variant` son el punto de
 * agarre de las pruebas por bloque (LND-6) y de las capturas. Cada bloque es
 * una función pura de sus props: ninguno importa a otro.
 */
export function Section({
  id,
  type,
  variant,
  tone = "plain",
  labelled = true,
  className,
  children,
}: {
  id: string
  type: string
  variant: string
  tone?: "plain" | "muted" | "brand"
  /** false si el bloque no tiene encabezado que lo nombre. */
  labelled?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      data-block={type}
      data-variant={variant}
      aria-labelledby={labelled ? `${id}-title` : undefined}
      className={cn(
        "scroll-mt-4 py-16 sm:py-24",
        tone === "muted" && "bg-muted/50",
        tone === "brand" && "bg-primary text-primary-foreground",
        className
      )}
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">{children}</div>
    </section>
  )
}

export function Heading({
  id,
  as: Tag = "h2",
  className,
  children,
}: {
  id: string
  as?: "h1" | "h2"
  className?: string
  children: React.ReactNode
}) {
  return (
    <Tag
      id={`${id}-title`}
      className={cn(
        "font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl",
        className
      )}
    >
      {children}
    </Tag>
  )
}
