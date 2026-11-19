import { forbidden } from "next/navigation"

import { FormAlert } from "@/components/form-alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getKysely } from "@/server/db/pool"
import { requireOnboardedUser } from "@/server/session"

import { es } from "../messages"
import { canSubscribe } from "../server/authz"
import { SETTINGS_PATH } from "../server/paths"
import { vapidPublicKey } from "../server/push"
import { countForUser } from "../server/store"
import { PushToggle } from "./push-toggle"
import { TestButton } from "./test-button"

/**
 * /settings/notifications-push — turn web push on or off for this device and
 * send oneself a test. Session + onboarding, then `push:subscribe` (else 403).
 * Only the person's own device count is shown, never endpoints.
 */
export default async function PushSettingsPage() {
  const session = await requireOnboardedUser(SETTINGS_PATH)
  if (!(await canSubscribe())) forbidden()
  const publicKey = vapidPublicKey()
  const [copy, devices] = await Promise.all([getModuleCopy(es), countForUser(getKysely(), session.user.id)])

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold">{copy.title}</h1>
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {publicKey ? (
          <>
            <p className="text-sm text-muted-foreground">{copy.devices(devices)}</p>
            <PushToggle publicKey={publicKey} />
            {devices > 0 ? <TestButton /> : null}
          </>
        ) : (
          <FormAlert>{copy.notConfigured}</FormAlert>
        )}
      </CardContent>
    </Card>
  )
}
