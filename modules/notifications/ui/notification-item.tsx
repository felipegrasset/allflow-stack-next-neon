import Link from "next/link"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { Notification } from "../contracts/input"
import { LOCALE, copy } from "../copy"
import { markReadAction } from "../server/actions"

/** Una fila: el estado "sin leer" se dice con texto, no solo con color. */
export function NotificationItem({ n }: { n: Notification }) {
  const unread = n.readAt === null
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-l-2 p-4 sm:flex-row sm:items-start sm:justify-between",
        unread ? "border-l-primary" : "border-l-transparent"
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          {copy.kinds[n.kind]}
          {unread ? ` · ${copy.page.unreadTag}` : ""}
          {" · "}
          <time dateTime={n.createdAt.toISOString()}>
            {n.createdAt.toLocaleString(LOCALE, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
        </p>
        <p className={cn("text-sm", unread && "font-medium")}>{n.title}</p>
        {n.body ? (
          <p className="text-sm text-muted-foreground">{n.body}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {n.href ? (
          <Link
            href={n.href}
            className="rounded-md text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {copy.page.open}
          </Link>
        ) : null}
        {unread ? (
          <form action={markReadAction}>
            <input type="hidden" name="id" value={n.id} />
            <Button type="submit" variant="ghost" size="sm">
              {copy.page.markRead}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  )
}
