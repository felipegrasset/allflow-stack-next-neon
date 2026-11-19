import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"

import { es } from "../messages"
import { requirePagePermission } from "../server/guard"
import { isEnabledWith } from "../server/store"
import { PreferenceForm } from "./preference-form"

/** /settings/notifications — your own email preference. Needs `notificationEmail:manage`. */
export default async function NotificationsEmailPage() {
  const session = await requirePagePermission("/settings/notifications")
  const [copy, enabled] = await Promise.all([getModuleCopy(es), isEnabledWith(getKysely(), session.user.id)])
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{copy.page.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.page.subtitle}</p>
        <p className="text-sm text-muted-foreground">{copy.page.sentTo(session.user.email)}</p>
        {process.env.RESEND_API_KEY ? null : (
          <p className="text-sm text-muted-foreground">{copy.page.noProvider}</p>
        )}
      </div>
      <PreferenceForm initial={enabled} />
    </div>
  )
}
