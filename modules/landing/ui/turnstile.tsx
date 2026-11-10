"use client"

import { useEffect, useRef } from "react"

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string
          theme?: "auto" | "light" | "dark"
          callback?: (token: string) => void
          "expired-callback"?: () => void
          "error-callback"?: () => void
        }
      ) => string
    }
  }
}

const SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

/**
 * Cloudflare Turnstile. El bloque solo lo monta si hay clave de sitio; el
 * token viaja en un input oculto `captchaToken` del formulario.
 */
export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string
  onToken: (t: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const rendered = useRef(false)

  useEffect(() => {
    let cancelled = false
    function render() {
      if (cancelled || rendered.current || !ref.current || !window.turnstile)
        return
      rendered.current = true
      window.turnstile.render(ref.current, {
        sitekey: siteKey,
        theme: "auto",
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      })
    }
    if (window.turnstile) render()
    else {
      let script = document.querySelector<HTMLScriptElement>(
        `script[src="${SRC}"]`
      )
      if (!script) {
        script = document.createElement("script")
        script.src = SRC
        script.async = true
        document.head.appendChild(script)
      }
      script.addEventListener("load", render)
    }
    return () => {
      cancelled = true
    }
  }, [siteKey, onToken])

  return <div ref={ref} className="min-h-[65px]" />
}
