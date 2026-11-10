import { Spinner } from "@/components/ui/spinner"
import { getCopy } from "@/modules/i18n/server/copy"

/** "Validating the link…" while the page checks the token. */
export default async function Loading() {
  const authCopy = await getCopy("auth")
  return (
    <div className="flex min-h-[40svh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <Spinner className="size-6" aria-hidden />
      <p role="status">{authCopy.reset.validating}</p>
    </div>
  )
}
