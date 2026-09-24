"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { authCopy } from "@/lib/copy/auth"
import { LoginForm } from "./login-form"
import { MagicLinkForm } from "./magic-link-form"

/** Password login by default; magic link one click away (plugin configured in server/auth). */
export function LoginPanel({ next }: { next: string }) {
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
