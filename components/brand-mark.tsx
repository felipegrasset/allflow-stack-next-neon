import { brand } from "@/config/brand"
import { APP_TITLE } from "@/lib/site"

/** The logo if config/brand.ts has one, the app's name otherwise. */
export function BrandMark({ className }: { className?: string }) {
  if (!brand.logo) return <span className={className}>{APP_TITLE}</span>
  // eslint-disable-next-line @next/next/no-img-element -- a small static logo; next/image adds nothing
  return <img src={brand.logo} alt={brand.alt} className={className ?? "h-6 w-auto"} />
}
