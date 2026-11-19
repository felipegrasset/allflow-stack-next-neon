import { Badge } from "@/components/ui/badge"

import type { OrderStatus } from "../contracts/types"

/** The status is always said in text too; the variant only helps scanning. */
export function StatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  const variant =
    status === "paid" || status === "fulfilled"
      ? "default"
      : status === "review"
        ? "destructive"
        : status === "pending"
          ? "outline"
          : "secondary"
  return <Badge variant={variant}>{label}</Badge>
}
