import { Badge } from "@/components/ui/badge"

import type { TicketStatus } from "../contracts/domain"

/** Open = filled, closed/resolved = secondary, in progress = outline. The state is also said in text. */
export function StatusBadge({ status, label }: { status: TicketStatus; label: string }) {
  const variant = status === "open" ? "default" : status === "in_progress" ? "outline" : "secondary"
  return <Badge variant={variant}>{label}</Badge>
}
