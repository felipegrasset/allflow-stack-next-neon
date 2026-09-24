import type { Metadata } from "next"

import { StatusScreen } from "@/components/system/status-screen"
import { ButtonLink } from "@/components/button-link"
import { authCopy } from "@/lib/copy/auth"

export const metadata: Metadata = { title: authCopy.notFound.title }

export default function NotFound() {
  return (
    <StatusScreen code="404" title={authCopy.notFound.title} description={authCopy.notFound.description}>
      <ButtonLink href="/">
        {authCopy.common.backHome}
      </ButtonLink>
    </StatusScreen>
  )
}
