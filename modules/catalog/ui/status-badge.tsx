import { Badge } from "@/components/ui/badge"

import type { ItemStatus } from "../contracts/types"

/** active = filled, draft = secondary, archived = outline. The label comes from copy.statuses. */
export function StatusBadge({ status, label }: { status: ItemStatus; label: string }) {
  const variant = status === "active" ? "default" : status === "draft" ? "secondary" : "outline"
  return <Badge variant={variant}>{label}</Badge>
}

/** Stock state for staff and visitors: out of stock, low (≤ 5), or the number. */
export function StockBadge({
  stock,
  labels,
}: {
  stock: number | null
  labels: { untracked: string; out: string; units: (n: number) => string }
}) {
  if (stock === null) return <Badge variant="outline">{labels.untracked}</Badge>
  if (stock <= 0) return <Badge variant="destructive">{labels.out}</Badge>
  return <Badge variant={stock <= 5 ? "secondary" : "outline"}>{labels.units(stock)}</Badge>
}
