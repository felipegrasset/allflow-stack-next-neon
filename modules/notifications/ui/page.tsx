import { Button } from "@/components/ui/button"
import { requireOnboardedUser } from "@/server/session"

import { copy } from "../copy"
import { markAllReadAction } from "../server/actions"
import { countUnread, listNotifications } from "../server/queries"
import { ItemList } from "./item-list"
import { NotificationItem } from "./notification-item"

export default async function NotificationsPage() {
  const { user } = await requireOnboardedUser("/notifications")
  const [items, unread] = await Promise.all([
    listNotifications(user.id),
    countUnread(user.id),
  ])
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{copy.page.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.page.subtitle}</p>
        </div>
        {unread > 0 ? (
          <form action={markAllReadAction}>
            <Button type="submit" variant="outline" size="sm">
              {copy.page.markAllRead}
            </Button>
          </form>
        ) : null}
      </div>
      <ItemList
        items={items}
        getKey={(n) => n.id}
        label={copy.page.listLabel}
        empty={copy.empty}
        renderItem={(n) => <NotificationItem n={n} />}
      />
    </div>
  )
}
