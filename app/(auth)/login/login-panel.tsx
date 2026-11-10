"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { LoginForm } from "./login-form"
import { MagicLinkForm } from "./magic-link-form"
import { useCopy } from "@/modules/i18n/ui/use-copy"

/** Password login by default; magic link one click away (plugin configured in server/auth). */
export function LoginPanel({ next }: { next: string }) {
  const authCopy = useCopy("auth")
  const [mode, setMode] = useState<"password" | "magic">("password")
  return (
    <div className="flex flex-col gap-4">
      {mode === "password" ? <LoginForm next={next} /> : <MagicLinkForm next={next} />}
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        {authCopy.common.or}
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setMode(mode === "password" ? "magic" : "password")}
      >
        {mode === "password" ? authCopy.magicLink.switchToMagic : authCopy.magicLink.switchToPassword}
      </Button>
    </div>
  )
}
