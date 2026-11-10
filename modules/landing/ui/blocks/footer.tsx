import Link from "next/link"

import { cn } from "@/lib/utils"

import type { CopyOf } from "../../schema"

type Props = {
  id: string
  variant: "simple" | "columns"
  copy: CopyOf<"footer">
}

export function FooterBlock({ id, variant, copy }: Props) {
  const columns = variant === "columns"
  return (
    <footer
      id={id}
      data-block="footer"
      data-variant={variant}
      aria-label={copy.tagline ?? copy.legal}
      className="border-t py-10"
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 sm:px-6",
          !columns && "items-center text-center"
        )}
      >
        {columns ? (
          <div className="grid gap-8 sm:grid-cols-[2fr_repeat(auto-fit,minmax(8rem,1fr))]">
            {copy.tagline && (
              <p className="font-heading font-semibold">{copy.tagline}</p>
            )}
            {copy.columns.map((c) => (
              <nav
                key={c.title}
                aria-label={c.title}
                className="flex flex-col gap-2 text-sm"
              >
                <p className="font-medium">{c.title}</p>
                {c.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            ))}
          </div>
        ) : (
          <nav
            aria-label={copy.tagline ?? copy.legal}
            className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm"
          >
            {copy.columns
              .flatMap((c) => c.links)
              .map((l) => (
                <Link
                  key={l.href + l.label}
                  href={l.href}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {l.label}
                </Link>
              ))}
          </nav>
        )}
        <p className="text-xs text-muted-foreground">{copy.legal}</p>
      </div>
    </footer>
  )
}
