import { ButtonLink } from "@/components/button-link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { DomainCopy } from "@/lib/domain/meta"

/**
 * Search (a plain GET form, works without JavaScript) and the "new" button
 * above a list. Copied by AllFlow's genesis from `genesis/templates/components/domain/`.
 */
export function ListToolbar({
  basePath,
  q,
  searchable,
  createHref,
  createLabel,
  copy,
}: {
  basePath: string
  q: string
  searchable: boolean
  createHref: string | null
  createLabel: string
  copy: DomainCopy
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {searchable && (
        <form action={basePath} role="search" className="flex flex-1 items-center gap-2">
          <Input
            name="q"
            type="search"
            defaultValue={q}
            aria-label={copy.search}
            placeholder={copy.searchPlaceholder}
            className="max-w-xs"
          />
          <Button type="submit" variant="outline">
            {copy.search}
          </Button>
        </form>
      )}
      {createHref && (
        <ButtonLink href={createHref} className="ml-auto">
          {createLabel}
        </ButtonLink>
      )}
    </div>
  )
}

/** Previous / next with "page X of Y"; renders nothing when everything fits on one page. */
export function Pagination({
  basePath,
  q,
  page,
  pages,
  copy,
}: {
  basePath: string
  q: string
  page: number
  pages: number
  copy: DomainCopy
}) {
  if (pages <= 1) return null
  const href = (p: number) => {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (p > 1) params.set("page", String(p))
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }
  return (
    <nav aria-label={copy.pageOf(page, pages)} className="flex items-center justify-between gap-2 text-sm">
      {page > 1 ? (
        <ButtonLink href={href(page - 1)} variant="outline" size="sm">
          {copy.previous}
        </ButtonLink>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground">{copy.pageOf(page, pages)}</span>
      {page < pages ? (
        <ButtonLink href={href(page + 1)} variant="outline" size="sm">
          {copy.next}
        </ButtonLink>
      ) : (
        <span />
      )}
    </nav>
  )
}
