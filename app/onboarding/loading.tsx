import { FormSkeleton } from "@/components/system/page-skeleton"

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-md p-6">
      <FormSkeleton fields={1} />
    </div>
  )
}
