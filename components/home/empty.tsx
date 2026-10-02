import Link from "next/link"

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import type { HomeEmpty } from "./types"

export function HomeEmptyState({ title, description, action }: HomeEmpty) {
  return (
    <Empty data-testid="home-empty" className="border py-10">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && (
        <EmptyContent>
          <Link href={action.href} className="text-sm font-medium text-primary underline underline-offset-4">
            {action.label}
          </Link>
        </EmptyContent>
      )}
    </Empty>
  )
}
