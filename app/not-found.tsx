import type { Metadata } from "next"

import { StatusScreen } from "@/components/system/status-screen"
import { ButtonLink } from "@/components/button-link"
import { getCopy } from "@/modules/i18n/server/copy"

export async function generateMetadata(): Promise<Metadata> {
  const authCopy = await getCopy("auth")
  return { title: authCopy.notFound.title }
}

export default async function NotFound() {
  const authCopy = await getCopy("auth")
  return (
    <StatusScreen code="404" title={authCopy.notFound.title} description={authCopy.notFound.description}>
      <ButtonLink href="/">
        {authCopy.common.backHome}
      </ButtonLink>
    </StatusScreen>
  )
}
