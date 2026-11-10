import { cn } from "@/lib/utils"

/** "9+" cuando `count` pasa de `max`. Puro: se prueba sin renderizar. */
export function formatCount(count: number, max = 99): string {
  return count > max ? `${max}+` : String(Math.max(0, Math.trunc(count)))
}

/**
 * Pastilla con un número. No renderiza nada si `count` es 0 (salvo `showZero`).
 * Es decorativa para lectores de pantalla (`aria-hidden`): quien la usa pone el
 * número en el nombre accesible de su enlace o botón. Tokens `primary`, AA en
 * claro y oscuro.
 */
export function CountBadge({
  count,
  max = 99,
  showZero = false,
  className,
}: {
  count: number
  max?: number
  showZero?: boolean
  className?: string
}) {
  if (count <= 0 && !showZero) return null
  return (
    <span
      aria-hidden
      data-slot="count-badge"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground tabular-nums",
        className
      )}
    >
      {formatCount(count, max)}
    </span>
  )
}
