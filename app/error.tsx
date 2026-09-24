"use client"

import { useEffect } from "react"

import { StatusScreen } from "@/components/system/status-screen"
import { ButtonLink } from "@/components/button-link"
import { Button } from "@/components/ui/button"
import { authCopy } from "@/lib/copy/auth"

/**
 * Error boundary of every route under the root layout. `retry()` (Next 16.3)
 * re-fetches and re-renders the segment; the old `reset()` only re-renders.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <StatusScreen
      title={authCopy.error.title}
      description={
        <>
          {authCopy.error.description}
          {error.digest && (
            <span className="mt-2 block font-mono text-xs">{authCopy.error.code(error.digest)}</span>
          )}
        </>
      }
    >
      <title>{authCopy.error.title}</title>
      <Button onClick={() => retry()}>{authCopy.common.retry}</Button>
      <ButtonLink href="/" variant="outline">
        {authCopy.common.backHome}
      </ButtonLink>
    </StatusScreen>
  )
}
