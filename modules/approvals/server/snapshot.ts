import { getKysely } from "@/server/db/pool"

import type { FlowDefinition } from "../contracts/flow"
import { parseDefinition } from "./store"

/** The flow definition a request was created with. Call only after the visibility check. */
export async function getFlowSnapshot(requestId: string): Promise<FlowDefinition | null> {
  const row = await getKysely()
    .selectFrom("approvals_requests")
    .select("definition")
    .where("id", "=", requestId)
    .executeTakeFirst()
  return row ? parseDefinition(row.definition) : null
}
