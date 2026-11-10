import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"

/** Estado vacío genérico: título, descripción y una acción opcional. Envuelve `components/ui/empty`. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <Empty className={cn("border border-dashed border-border", className)}>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action}
    </Empty>
  )
}
