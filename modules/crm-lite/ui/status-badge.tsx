import { Badge } from "@/components/ui/badge"

import type { ContactStatus } from "../contracts/domain"

/** Lead = outline, customer = filled. The label comes from the caller (copy.statuses). */
export function StatusBadge({
  status,
  label,
}: {
  status: ContactStatus
  label: string
}) {
  return (
    <Badge variant={status === "customer" ? "default" : "outline"}>
      {label}
    </Badge>
  )
}
