import { FormSkeleton } from "@/components/system/page-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-40" aria-hidden />
      <FormSkeleton fields={3} />
    </div>
  )
}
