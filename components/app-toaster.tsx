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
import { authCopy } from "@/lib/copy/auth"

/**
 * The app's <Toaster />, rendered once in app/layout.tsx. Without it
 * `toast.add()` does nothing and nobody notices.
 *
 * It composes components/ui/toast.tsx (read-only zone) instead of using its
 * <Toaster>, only to put the close button's label in Spanish.
 *
 *   import { toast } from "@/components/ui/toast"
 *   toast.add({ title: "Perfil actualizado", type: "success" })
 */
function ToastList() {
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
