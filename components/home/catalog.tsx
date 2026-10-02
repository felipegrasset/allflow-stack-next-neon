import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HomeEmptyState } from "./empty"
import type { HomeEmpty } from "./types"

export type CatalogItem = { id: string; name: string; price?: string; image?: string; href?: string }

/** `catalog`: a grid of cards with image, name and price. */
export function CatalogHome({ title, items, empty }: { title: string; items: CatalogItem[]; empty: HomeEmpty }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {items.length === 0 ? (
        <HomeEmptyState {...empty} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <Card key={it.id} data-testid="home-catalog-item">
              {it.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote hosts are unknown to the template
                <img src={it.image} alt="" className="aspect-square w-full object-cover" loading="lazy" />
              ) : (
                <div aria-hidden className="aspect-square w-full bg-muted" />
              )}
              <CardHeader>
                <CardTitle>
                  {it.href ? (
                    <Link href={it.href} className="hover:underline">
                      {it.name}
                    </Link>
                  ) : (
                    it.name
                  )}
                </CardTitle>
              </CardHeader>
              {it.price && <CardContent className="font-medium tabular-nums">{it.price}</CardContent>}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
