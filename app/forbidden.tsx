import type { Metadata } from "next"

import { StatusScreen } from "@/components/system/status-screen"
import { ButtonLink } from "@/components/button-link"
import { authCopy } from "@/lib/copy/auth"

export const metadata: Metadata = { title: authCopy.forbidden.title }

/**
 * 403 — signed in, but without the required role. Rendered (with a real 403
 * status) when a Server Component calls forbidden(); see requireAdmin() in
 * server/session.ts. Distinct from 404 on purpose: the page exists.
 */
export default function Forbidden() {
  return (
    <StatusScreen code="403" title={authCopy.forbidden.title} description={authCopy.forbidden.description}>
      <ButtonLink href="/">
        {authCopy.common.backHome}
      </ButtonLink>
    </StatusScreen>
  )
}
