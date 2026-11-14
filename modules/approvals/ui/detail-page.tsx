import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { requireOnboardedUser } from "@/server/session"

import { REQUEST_EVENT_ACTION } from "../contracts/types"
import { findState, localize } from "../contracts/flow"
import { es } from "../messages"
import { currentActor } from "../server/authz"
import { getRequestView, listEvents } from "../server/queries"
import { getFlowSnapshot } from "../server/snapshot"
import { DecisionForm } from "./decision-form"
import { activeLocale } from "./locale"

const linkClass =
  "rounded-md text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireOnboardedUser(`/approvals/${encodeURIComponent(id)}`)
  if (id.length > 200) notFound()
  const [actor, copy, locale] = await Promise.all([
    currentActor(),
    getModuleCopy(es),
    activeLocale(),
  ])
  const req = await getRequestView(id, actor, locale)
  if (!req) notFound()
  const [events, def] = await Promise.all([listEvents(req.id), getFlowSnapshot(req.id)])
  if (!def) notFound()

  const label = (key: string | null) => {
    if (!key) return ""
    const s = findState(def, key)
    return s ? localize(s.label, locale) : key
  }
  const actionLabel = (from: string | null, action: string) => {
    const t = def.transitions.find((x) => x.from === from && x.action === action)
    return t ? localize(t.label, locale) : action
  }
  const stateLabels = Object.fromEntries(def.states.map((s) => [s.key, localize(s.label, locale)]))

  return (
    <div className="flex flex-col gap-6">
      <Link href="/approvals" className={linkClass}>
        {copy.detail.back}
      </Link>
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{req.flowName}</p>
        <h1 className="text-xl font-semibold">{req.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant={req.final ? "secondary" : "outline"}>
            {copy.request.state(req.stateLabel)}
          </Badge>
          <span>{req.closedAt ? copy.request.closedTag : copy.request.openTag}</span>
          <span>· {copy.request.requestedBy(req.requesterName ?? copy.request.unknownUser)}</span>
          {req.href ? (
            <Link href={req.href} className={linkClass}>
              {copy.request.goToRecord}
            </Link>
          ) : null}
        </div>
      </div>

      {req.closedAt ? null : (
        <section className="flex flex-col gap-3" aria-labelledby="approvals-decide">
          <h2 id="approvals-decide" className="text-base font-medium">
            {copy.detail.decideTitle}
          </h2>
          {req.actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{copy.detail.noActions}</p>
          ) : (
            <DecisionForm
              requestId={req.id}
              state={req.state}
              options={req.actions}
              stateLabels={stateLabels}
            />
          )}
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="approvals-history">
        <h2 id="approvals-history" className="text-base font-medium">
          {copy.detail.history}
        </h2>
        <ol className="flex flex-col gap-3 border-l border-border pl-4">
          {events.map((e) => {
            const name = e.actorName ?? copy.request.unknownUser
            return (
              <li key={e.id} className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">
                  <time dateTime={e.createdAt.toISOString()}>{formatDateTime(e.createdAt, locale)}</time>
                </p>
                <p className="text-sm">
                  {e.action === REQUEST_EVENT_ACTION
                    ? copy.detail.created(name)
                    : copy.detail.moved(
                        name,
                        actionLabel(e.fromState, e.action),
                        label(e.fromState),
                        label(e.toState)
                      )}
                </p>
                {e.comment ? (
                  <p className="text-sm whitespace-pre-line text-muted-foreground">{e.comment}</p>
                ) : null}
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
