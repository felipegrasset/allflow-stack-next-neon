import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/**
 * The whole-form message. Errors are announced on appearance (role="alert",
 * a11y rule 3); success is a polite status, so it doesn't interrupt.
 */
export function FormAlert({
  variant = "destructive",
  title,
  children,
}: {
  variant?: "destructive" | "success"
  title?: string
  children: React.ReactNode
}) {
  if (variant === "success") {
    return (
      <Alert role="status" aria-live="polite" data-variant="success">
        <CircleCheckIcon aria-hidden />
        {title && <AlertTitle>{title}</AlertTitle>}
        <AlertDescription>{children}</AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlertIcon aria-hidden />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
