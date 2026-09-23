/**
 * Dark mode without next-themes (decision D9, 23/09/2026).
 *
 * Two pieces:
 *  - <ThemeScript />, rendered in <head> by app/layout.tsx: six lines that set
 *    `.dark` on <html> BEFORE the first paint (no flash), from
 *    localStorage.theme or, if unset, prefers-color-scheme.
 *  - useTheme(): reads the same state through useSyncExternalStore — the store
 *    is the DOM + localStorage, not React state, so a hidden <Activity> tree
 *    (cacheComponents) can't write back a stale theme (next-themes #375).
 *
 * No "use client" here on purpose: the layout (a Server Component) renders
 * <ThemeScript />; the hook is only called from client components.
 */
import * as React from "react"

export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

const THEME_SCRIPT = `(function () { try {
  var t = localStorage.theme;
  document.documentElement.classList.toggle("dark",
    t === "dark" ||
    (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches));
} catch (e) {} })();`

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
}

const QUERY = "(prefers-color-scheme: dark)"
const listeners = new Set<() => void>()

function stored(): Theme {
  try {
    const t = localStorage.getItem("theme")
    return t === "light" || t === "dark" ? t : "system"
  } catch {
    return "system"
  }
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme !== "system") return theme
  return window.matchMedia(QUERY).matches ? "dark" : "light"
}

function apply() {
  document.documentElement.classList.toggle("dark", resolve(stored()) === "dark")
  listeners.forEach((l) => l())
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  const mq = window.matchMedia(QUERY)
  const onStorage = (e: StorageEvent) => e.key === "theme" && apply()
  mq.addEventListener("change", apply)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(onChange)
    mq.removeEventListener("change", apply)
    window.removeEventListener("storage", onStorage)
  }
}

/** One string so the snapshot is a primitive (stable between renders). */
const getSnapshot = () => `${stored()}:${resolve(stored())}`
/** null on the server: the theme is unknown until hydration — render a neutral placeholder. */
const getServerSnapshot = () => null

export function setTheme(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem("theme")
    else localStorage.setItem("theme", theme)
  } catch {}
  apply()
}

export function useTheme(): {
  theme: Theme | null
  resolvedTheme: ResolvedTheme | null
  setTheme: (theme: Theme) => void
} {
  const snap = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  if (!snap) return { theme: null, resolvedTheme: null, setTheme }
  const [theme, resolvedTheme] = snap.split(":") as [Theme, ResolvedTheme]
  return { theme, resolvedTheme, setTheme }
}
