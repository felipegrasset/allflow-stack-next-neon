"use client"

import { useEffect } from "react"

/**
 * Re-applies the theme class after hydration. <ThemeScript /> covers every
 * normal page load, but when a layout calls forbidden()/notFound()/redirect()
 * before streaming starts, Next answers with an error shell that is rendered
 * on the client — and a <script> rendered by React on the client never runs.
 * Without this, a 403 in dark mode paints light. Same logic as ThemeScript.
 */
export function ThemeSync() {
  useEffect(() => {
    try {
      const t = localStorage.getItem("theme")
      document.documentElement.classList.toggle(
        "dark",
        t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches)
      )
    } catch {}
  }, [])
  return null
}
