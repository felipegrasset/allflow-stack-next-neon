import Link from "next/link"
import type { VariantProps } from "class-variance-authority"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * A link that LOOKS like a button. Navigation must stay a link (role "link",
 * middle-click, "open in new tab"): `<Button render={<Link/>} nativeButton={false}>`
 * gives it role="button" instead, which screen readers and tests read wrong.
 */
export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return <Link data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
