import Link from "next/link"

import { BrandMark } from "@/components/brand-mark"
import { ThemeToggle } from "@/components/theme-toggle"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between p-4">
        <Link href="/" className="text-sm font-medium">
          <BrandMark />
        </Link>
        <ThemeToggle />
      </header>
      <main id="contenido" className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
