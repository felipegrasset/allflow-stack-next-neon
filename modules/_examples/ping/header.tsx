import { getModuleCopy } from "@/modules/i18n/contracts/server"

import type { ModuleHeaderSlotProps } from "../contract/types"
import { es } from "./messages"
import { countPings } from "./server/queries"

/** A header slot is a server component: it may query. This is what the notifications bell will be. */
export default async function PingHeader({ user }: ModuleHeaderSlotProps) {
  const [n, copy] = await Promise.all([countPings(), getModuleCopy(es)])
  return (
    <span
      className="text-xs text-muted-foreground"
      title={copy.header.who(user.name)}
    >
      {copy.header.count(n)}
    </span>
  )
}
