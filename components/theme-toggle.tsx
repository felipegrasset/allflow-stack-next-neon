"use client"

import { MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const next = resolvedTheme === "dark" ? "light" : "dark"
  return (
    <Button
      variant="ghost"
      size="icon"
      // Before hydration the theme is unknown: same markup, no icon swap flash.
      aria-label={resolvedTheme ? `Cambiar a modo ${next === "dark" ? "oscuro" : "claro"}` : "Cambiar tema"}
      onClick={() => setTheme(next)}
    >
      {resolvedTheme === "dark" ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
    </Button>
  )
}
