import type { ModuleHeaderSlotProps } from "../contract/types"
import { countPings } from "./server/queries"

/** A header slot is a server component: it may query. This is what the notifications bell will be. */
export default async function PingHeader({ user }: ModuleHeaderSlotProps) {
  const n = await countPings()
  return (
    <span className="text-xs text-muted-foreground" title={user.name}>
      {n} ping(s)
    </span>
  )
}
