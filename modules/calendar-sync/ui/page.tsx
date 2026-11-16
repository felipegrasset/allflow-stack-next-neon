import { forbidden } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { requireOnboardedUser } from "@/server/session"

import { es } from "../messages"
import { canConnectCalendar } from "../server/authz"
import { CONNECT_PATH, SETTINGS_PATH, isReturnStatus } from "../server/paths"
import { config, store } from "../server/runtime"
import { AccountActions } from "./account-actions"
import { activeLocale } from "./locale"

/**
 * /settings/calendar — the signed-in person's own Google Calendar connection:
 * state, connect / reconnect, sync now, disconnect, and how many of their
 * bookings are in each sync state. Needs `calendar:connect`.
 */
export default async function CalendarSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>
}) {
  const session = await requireOnboardedUser(SETTINGS_PATH)
  if (!(await canConnectCalendar())) forbidden()
  const s = store()
  const [copy, locale, account, counts, params] = await Promise.all([
    getModuleCopy(es),
    activeLocale(),
    s.getAccount(session.user.id),
    s.countEvents(session.user.id),
    searchParams,
  ])
  const cfg = config()
  const returned = typeof params.status === "string" && isReturnStatus(params.status) ? params.status : null
  const connected = account?.status === "connected"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
      </div>

      {returned ? (
        <FormAlert variant={returned === "connected" ? "success" : "destructive"}>{copy.returned[returned]}</FormAlert>
      ) : null}

      {!cfg.ok ? (
        <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm">
          {cfg.keyInvalid ? copy.config.keyInvalid : copy.config.notConfigured(cfg.missing.join(", "))}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {copy.title}
            <Badge variant={connected ? "secondary" : "outline"}>
              {connected ? copy.state.connected : account ? copy.state.disconnected : copy.state.never}
            </Badge>
          </CardTitle>
          {connected && account ? (
            <CardDescription>{copy.state.since(formatDate(account.connectedAt, locale, "long"))}</CardDescription>
          ) : account?.disconnectReason ? (
            <CardDescription>{copy.reasons[account.disconnectReason]}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {connected ? (
            <AccountActions />
          ) : cfg.ok ? (
            <div>
              {/* A plain link: the route handler checks the session and redirects to Google. */}
              <a href={CONNECT_PATH} className={buttonVariants()}>
                {account ? copy.actions.reconnect : copy.actions.connect}
              </a>
            </div>
          ) : null}
          <p className="text-muted-foreground">{copy.direction}</p>
          <p className="text-muted-foreground">{copy.privacy}</p>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-2" aria-labelledby="calendar-sync-counts">
        <h2 id="calendar-sync-counts" className="text-base font-medium">
          {copy.counts.title}
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          <li>{copy.counts.synced(counts.synced)}</li>
          <li>{copy.counts.pending(counts.pending)}</li>
          <li>{copy.counts.failed(counts.failed)}</li>
          <li>{copy.counts.skipped(counts.skipped)}</li>
        </ul>
      </section>
    </div>
  )
}
