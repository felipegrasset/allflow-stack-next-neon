"use client"

import { XIcon } from "lucide-react"

import {
  Toast,
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  toast,
  useToastManager,
} from "@/components/ui/toast"
import { useCopy } from "@/modules/i18n/ui/use-copy"

/**
 * The app's <Toaster />, rendered once in app/layout.tsx. Without it
 * `toast.add()` does nothing and nobody notices.
 *
 * It composes components/ui/toast.tsx (read-only zone) instead of using its
 * <Toaster>, only to put the close button's label in the active language.
 *
 *   import { toast } from "@/components/ui/toast"
 *   toast.add({ title: copy.saved, type: "success" })
 */
function ToastList() {
  const authCopy = useCopy("auth")
  const { toasts } = useToastManager()
  return toasts.map((t) => (
    <Toast key={t.id} toast={t} data-testid="toast">
      <ToastContent>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <ToastTitle />
          <ToastDescription />
        </div>
        <ToastClose aria-label={authCopy.toast.close}>
          <XIcon aria-hidden />
        </ToastClose>
      </ToastContent>
    </Toast>
  ))
}

export function AppToaster() {
  const authCopy = useCopy("auth")
  return (
    <ToastProvider toastManager={toast}>
      <ToastPortal>
        <ToastViewport aria-label={authCopy.toast.region}>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  )
}
