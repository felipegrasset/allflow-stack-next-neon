import { requireOnboardedUser } from "@/server/session"

import { listPings } from "../server/queries"

export default async function PingPage() {
  await requireOnboardedUser("/ping")
  const pings = await listPings()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Ping</h1>
      <ul className="flex flex-col gap-1 text-sm">
        {pings.map((p) => (
          <li key={p.id}>{p.message}</li>
        ))}
      </ul>
    </div>
  )
}
