import { SERVICE_WINDOW_MS } from "../contracts/types"

/**
 * WhatsApp's customer-service window: free text is allowed only for 24 h
 * after the person's LAST inbound message (rolling, not from the first one).
 * Outside it, only approved templates. A Meta rule, whatever the provider.
 * `null` (never wrote to us) means no window.
 */
export function withinServiceWindow(
  lastInboundAt: Date | null,
  now: Date = new Date()
): boolean {
  if (!lastInboundAt) return false
  const t = lastInboundAt.getTime()
  if (!Number.isFinite(t)) return false
  const age = now.getTime() - t
  // A timestamp in the future is a clock problem: do not open a window with it.
  return age >= 0 && age < SERVICE_WINDOW_MS
}
