"use client"

import { useEffect, useRef, useState } from "react"
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { StatusScreen } from "@/components/system/status-screen"
import { ButtonLink } from "@/components/button-link"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import { authCopy } from "@/lib/copy/auth"

type State = { kind: "loading" } | { kind: "ok" } | { kind: "error"; expired: boolean }

/** Verification callback: full-screen spinner → verified + CTA, or expired/invalid + "ask for a new link". */
export function VerifyToken({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" })
  const started = useRef(false)
  const c = authCopy.verifyCallback

  useEffect(() => {
    if (started.current) return // StrictMode runs effects twice in dev; the token is single-use.
    started.current = true
    authClient
      .verifyEmail({ query: { token } })
      .then(({ error }) => {
        if (!error) return setState({ kind: "ok" })
        setState({ kind: "error", expired: error.code === "TOKEN_EXPIRED" })
      })
      .catch(() => setState({ kind: "error", expired: false }))
  }, [token])

  if (state.kind === "loading") {
    return (
      <StatusScreen
        withMain={false}
        title={c.verifying}
        icon={<Spinner className="size-8 text-muted-foreground" aria-hidden />}
        className="min-h-[40svh] justify-center"
      >
        <span role="status" className="sr-only">
          {c.verifying}
        </span>
      </StatusScreen>
    )
  }

  if (state.kind === "ok") {
    return (
      <StatusScreen
        withMain={false}
        title={c.success}
        description={c.successDescription}
        icon={<CircleCheckIcon className="size-10 text-primary" aria-hidden />}
      >
        <ButtonLink href="/">
          {c.continue}
        </ButtonLink>
      </StatusScreen>
    )
  }

  return (
    <StatusScreen
      withMain={false}
      title={state.expired ? c.expired : c.invalid}
      description={c.errorDescription}
      icon={<CircleAlertIcon className="size-10 text-destructive" aria-hidden />}
    >
      <ButtonLink href="/verify-email">
        {c.resendCta}
      </ButtonLink>
    </StatusScreen>
  )
}
