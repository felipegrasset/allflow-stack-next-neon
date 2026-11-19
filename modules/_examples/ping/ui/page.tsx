import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { requireOnboardedUser } from "@/server/session"

import { es } from "../messages"
import { listPings } from "../server/queries"

export default async function PingPage() {
  await requireOnboardedUser("/ping")
  const [pings, copy] = await Promise.all([listPings(), getModuleCopy(es)])
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{copy.title}</h1>
      {pings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {pings.map((p) => (
            <li key={p.id}>{p.message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
