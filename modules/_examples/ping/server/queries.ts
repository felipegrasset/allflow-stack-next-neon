import { getKysely } from "@/server/db/pool"

import type { Ping } from "../contracts"

export async function listPings(limit = 20): Promise<Ping[]> {
  return getKysely()
    .selectFrom("ping_pings")
    .select(["id", "message"])
    .orderBy("created_at", "desc")
    .limit(limit)
    .execute()
}

export async function countPings(): Promise<number> {
  const row = await getKysely()
    .selectFrom("ping_pings")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .executeTakeFirstOrThrow()
  return Number(row.n)
}
