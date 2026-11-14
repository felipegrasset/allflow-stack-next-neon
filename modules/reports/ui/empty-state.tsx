import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <Empty className="border border-dashed border-border">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
    </Empty>
  )
}
