import Link from "next/link"

import type { ModuleHeaderSlotProps } from "../contract/types"
import { copy } from "./copy"
import { countUnread } from "./server/queries"
import { CountBadge } from "./ui/count-badge"

/**
 * El contador de no leídas en la cabecera: un enlace a /notifications, sin
 * popover. Si la consulta falla (p. ej. migración sin aplicar) la cabecera
 * sigue mostrando el enlace sin contador: un aviso no tumba el shell.
 */
export default async function NotificationsHeader({
  user,
}: ModuleHeaderSlotProps) {
  let unread = 0
  try {
    unread = await countUnread(user.id)
  } catch {
    unread = 0
  }
  return (
    <Link
      href="/notifications"
      aria-label={
        unread > 0 ? copy.header.withUnread(unread) : copy.header.link
      }
      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span aria-hidden>{copy.header.link}</span>
      <CountBadge count={unread} />
    </Link>
  )
}
