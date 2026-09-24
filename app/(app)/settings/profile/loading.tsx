import { FormSkeleton } from "@/components/system/page-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

/** Skeleton of the profile page: title, avatar card, form card. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-32" aria-hidden />
      <div className="flex items-center gap-4 rounded-xl border p-6" aria-hidden>
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
      <FormSkeleton fields={3} />
    </div>
  )
}
