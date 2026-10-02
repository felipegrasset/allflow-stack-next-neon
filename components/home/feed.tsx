import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HomeEmptyState } from "./empty"
import type { HomeEmpty } from "./types"

export type FeedItem = { id: string; title: string; body?: string; author?: string; date: string; href?: string }

/** `feed`: a chronological wall (newest first) with author and date. */
export function FeedHome({ title, items, empty }: { title: string; items: FeedItem[]; empty: HomeEmpty }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {items.length === 0 ? (
        <HomeEmptyState {...empty} />
      ) : (
        <ol className="flex flex-col gap-3">
          {[...items]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((it) => (
              <li key={it.id}>
                <Card data-testid="home-feed-item">
                  <CardHeader>
                    <CardTitle>
                      {it.href ? (
                        <Link href={it.href} className="hover:underline">
                          {it.title}
                        </Link>
                      ) : (
                        it.title
                      )}
                    </CardTitle>
                    <CardDescription>{[it.author, it.date].filter(Boolean).join(" · ")}</CardDescription>
                  </CardHeader>
                  {it.body && <CardContent className="text-muted-foreground">{it.body}</CardContent>}
                </Card>
              </li>
            ))}
        </ol>
      )}
    </div>
  )
}
