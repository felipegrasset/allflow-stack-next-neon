import type { Metadata } from "next"

import { authCopy } from "@/lib/copy/auth"
import { VerifyToken } from "./verify-token"

export const metadata: Metadata = { title: authCopy.verifyCallback.title }

/**
 * Where the verification email points (server/email/templates.ts rewrites
 * Better Auth's API link to this page). The token is checked from the browser
 * so the session cookie of autoSignInAfterVerification lands.
 */
export default async function VerifyTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <VerifyToken token={decodeURIComponent(token)} />
}
