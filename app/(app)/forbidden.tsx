import type { Metadata } from "next"

import { ButtonLink } from "@/components/button-link"
import { StatusScreen } from "@/components/system/status-screen"
import { authCopy } from "@/lib/copy/auth"

export const metadata: Metadata = { title: authCopy.forbidden.title }

/** 403 inside the signed-in shell (which already has the <main>). See app/forbidden.tsx. */
export default function Forbidden() {
  return (
    <StatusScreen withMain={false} className="py-12" code="403" title={authCopy.forbidden.title} description={authCopy.forbidden.description}>
      <ButtonLink href="/">{authCopy.common.backHome}</ButtonLink>
    </StatusScreen>
  )
}
