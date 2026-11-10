import type { Metadata } from "next"

import { StatusScreen } from "@/components/system/status-screen"
import { ButtonLink } from "@/components/button-link"
import { getCopy } from "@/modules/i18n/server/copy"

export async function generateMetadata(): Promise<Metadata> {
  const authCopy = await getCopy("auth")
  return { title: authCopy.forbidden.title }
}

/**
 * 403 — signed in, but without the required role. Rendered (with a real 403
 * status) when a Server Component calls forbidden(); see requireAdmin() in
 * server/session.ts. Distinct from 404 on purpose: the page exists.
 */
export default async function Forbidden() {
  const authCopy = await getCopy("auth")
  return (
    <StatusScreen code="403" title={authCopy.forbidden.title} description={authCopy.forbidden.description}>
      <ButtonLink href="/">
        {authCopy.common.backHome}
      </ButtonLink>
    </StatusScreen>
  )
}
