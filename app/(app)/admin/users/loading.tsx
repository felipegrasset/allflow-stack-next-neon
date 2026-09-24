import { TableSkeleton } from "@/components/system/page-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

/** Table skeleton, not a spinner: same height as the table, no layout shift. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2" aria-hidden>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>
      <TableSkeleton />
    </div>
  )
}
