"use client"

import { useEffect } from "react"
import { CircleAlertIcon } from "lucide-react"

import { StatusScreen } from "@/components/system/status-screen"
import { Button } from "@/components/ui/button"
import { useCopy } from "@/modules/i18n/ui/use-copy"

/** The users list failed to load: say so, and offer to retry (re-fetches the segment). */
export default function AdminUsersError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const authCopy = useCopy("auth")
  const profileCopy = useCopy("profile")
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <StatusScreen
      withMain={false}
      className="py-12"
      icon={<CircleAlertIcon className="size-10 text-destructive" aria-hidden />}
      title={profileCopy.adminUsers.loadError}
      description={profileCopy.adminUsers.loadErrorDescription}
    >
      <Button onClick={() => retry()}>{authCopy.common.retry}</Button>
    </StatusScreen>
  )
}
