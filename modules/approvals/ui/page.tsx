import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { requireOnboardedUser } from "@/server/session"

import { es } from "../messages"
import { currentActor } from "../server/authz"
import { listMine, listPending } from "../server/queries"
import { activeLocale } from "./locale"
import { RequestList } from "./request-list"

function EmptyBox({ title, description }: { title: string; description?: string }) {
  return (
    <Empty className="border border-dashed border-border">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
    </Empty>
  )
}

export default async function ApprovalsPage() {
  await requireOnboardedUser("/approvals")
  const [actor, copy, locale] = await Promise.all([
    currentActor(),
    getModuleCopy(es),
    activeLocale(),
  ])
  const [pending, mine] = await Promise.all([
    listPending(actor, locale),
    listMine(actor, locale),
  ])
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{copy.inbox.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.inbox.subtitle}</p>
      </div>
      <section className="flex flex-col gap-3" aria-labelledby="approvals-pending">
        <h2 id="approvals-pending" className="text-base font-medium">
          {copy.inbox.pendingTitle}
        </h2>
        {pending.length === 0 ? (
          <EmptyBox title={copy.inbox.pendingEmpty} description={copy.inbox.pendingEmptyHint} />
        ) : (
          <RequestList items={pending} label={copy.inbox.pendingTitle} copy={copy} locale={locale} />
        )}
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="approvals-mine">
        <h2 id="approvals-mine" className="text-base font-medium">
          {copy.inbox.mineTitle}
        </h2>
        {mine.length === 0 ? (
          <EmptyBox title={copy.inbox.mineEmpty} />
        ) : (
          <RequestList items={mine} label={copy.inbox.mineTitle} copy={copy} locale={locale} />
        )}
      </section>
    </div>
  )
}
