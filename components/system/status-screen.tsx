import { cn } from "@/lib/utils"

/**
 * The layout of the system screens (404, 403, error, verification results):
 * a centered block with a big status code or icon, a title (the page's <h1>),
 * a description and the actions. Wraps itself in <main id="contenido"> unless
 * the surrounding layout already provides one.
 */
export function StatusScreen({
  code,
  icon,
  title,
  description,
  children,
  withMain = true,
  className,
}: {
  code?: string
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  withMain?: boolean
  className?: string
}) {
  const body = (
    <div className={cn("mx-auto flex max-w-md flex-col items-center gap-4 text-center", className)}>
      {code && (
        <p className="text-5xl font-semibold tracking-tight text-muted-foreground tabular-nums" aria-hidden>
          {code}
        </p>
      )}
      {icon}
      <h1 className="text-xl font-semibold">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  )
  if (!withMain) return body
  return (
    <main id="contenido" className="flex min-h-svh flex-col items-center justify-center p-6">
      {body}
    </main>
  )
}
