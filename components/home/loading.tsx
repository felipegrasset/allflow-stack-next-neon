import { Skeleton } from "@/components/ui/skeleton"

/** Generic loading state for any home layout (use from a loading.tsx). */
export function HomeLoading() {
  return (
    <div data-testid="home-loading" aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-7 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}
