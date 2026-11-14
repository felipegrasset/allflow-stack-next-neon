import { ButtonLink } from "@/components/button-link"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { es } from "../messages"
import { can, requirePagePermission } from "../server/guard"
import { listBoardDeals } from "../server/queries"
import { Board } from "./board"

/** /crm — the pipeline. Needs `deal:read`; moving needs `deal:write`. */
export default async function PipelinePage() {
  await requirePagePermission("/crm", ["deal", "read"])
  const [copy, deals, canWrite, canContacts] = await Promise.all([
    getModuleCopy(es),
    listBoardDeals(),
    can("deal", "write"),
    can("contact", "read"),
  ])
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{copy.pipeline.title}</h1>
          <p className="text-sm text-muted-foreground">
            {copy.pipeline.subtitle}
          </p>
        </div>
        {canContacts ? (
          <ButtonLink href="/crm/contacts" variant="outline" size="sm">
            {copy.pipeline.contactsLink}
          </ButtonLink>
        ) : null}
      </div>
      {deals.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium">{copy.pipeline.empty}</p>
          <p className="text-sm text-muted-foreground">
            {copy.pipeline.emptyHint}
          </p>
        </div>
      ) : (
        <Board deals={deals} canWrite={canWrite} />
      )}
    </div>
  )
}
