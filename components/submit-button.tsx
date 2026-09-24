import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

/**
 * Submit button with the pending state of CONVENTIONS.md rule 5: `disabled` +
 * `aria-busy` + a spinner + a label that says what is happening. `disabled`
 * alone does not tell a screen reader "I'm working".
 */
export function SubmitButton({
  pending,
  label,
  pendingLabel,
  className,
  variant,
  type = "submit",
  onClick,
  disabled,
}: {
  pending: boolean
  label: string
  pendingLabel: string
  className?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  type?: "submit" | "button"
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <Button
      type={type}
      variant={variant}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={className}
      onClick={onClick}
    >
      {pending && <Spinner aria-hidden />}
      {pending ? pendingLabel : label}
    </Button>
  )
}
