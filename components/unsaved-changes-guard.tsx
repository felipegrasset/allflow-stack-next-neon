"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { profileCopy } from "@/lib/copy/profile"

/**
 * Warns before leaving a form with unsaved changes ("estado sucio"):
 *  - closing/reloading the tab → the browser's own beforeunload prompt;
 *  - clicking an in-app link → an AlertDialog; "leave" follows the link.
 * The App Router has no navigation-blocking API, so links are intercepted in
 * the capture phase, before next/link handles them.
 */
export function UnsavedChangesGuard({ dirty }: { dirty: boolean }) {
  const router = useRouter()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const c = profileCopy.profile

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return
      e.preventDefault()
      e.stopPropagation()
      setPendingHref(url.pathname + url.search + url.hash)
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [dirty])

  return (
    <AlertDialog open={pendingHref !== null} onOpenChange={(open) => !open && setPendingHref(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{c.unsavedTitle}</AlertDialogTitle>
          <AlertDialogDescription>{c.unsavedDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{c.unsavedStay}</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => {
              const href = pendingHref
              setPendingHref(null)
              if (href) router.push(href)
            }}
          >
            {c.unsavedLeave}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
