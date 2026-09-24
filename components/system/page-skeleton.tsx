import { Skeleton } from "@/components/ui/skeleton"
import { profileCopy } from "@/lib/copy/profile"

/**
 * Generic page skeleton (loading.tsx). Skeletons, not spinners: they reserve
 * the layout, so nothing jumps when the content arrives. The status text is
 * for screen readers; the blocks are decorative.
 */
export function PageSkeleton({ label = profileCopy.loading.page }: { label?: string }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6" data-testid="page-skeleton">
      <span role="status" className="sr-only">
        {label}
      </span>
      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div aria-hidden className="flex flex-col gap-4 rounded-xl border p-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-32" />
      </div>
    </div>
  )
}

/** Skeleton for a form card (settings pages). */
export function FormSkeleton({ fields = 2, label = profileCopy.loading.form }: { fields?: number; label?: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border p-6" data-testid="form-skeleton">
      <span role="status" className="sr-only">
        {label}
      </span>
      <div aria-hidden className="flex flex-col gap-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
        <Skeleton className="h-8 w-32" />
      </div>
    </div>
  )
}

/** Table skeleton (admin/users): rows of the same height as the real table. */
export function TableSkeleton({ rows = 5, label = profileCopy.loading.table }: { rows?: number; label?: string }) {
  return (
    <div className="rounded-xl border" data-testid="table-skeleton">
      <span role="status" className="sr-only">
        {label}
      </span>
      <div aria-hidden className="divide-y">
        <div className="flex gap-4 p-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="ml-auto h-7 w-32" />
          </div>
        ))}
      </div>
    </div>
  )
}
