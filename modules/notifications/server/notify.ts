import { getKysely } from "@/server/db/pool"

import {
  notifyInputSchema,
  type NotifyInput,
  type NotifyResult,
} from "../contracts/input"

/** Crea un aviso. Lanza `ZodError` si la entrada no es válida. Con `id` es idempotente. */
export async function notify(input: NotifyInput): Promise<NotifyResult> {
  const v = notifyInputSchema.parse(input)
  const id = v.id ?? crypto.randomUUID()
  const row = await getKysely()
    .insertInto("notifications")
    .values({
      id,
      user_id: v.userId,
      kind: v.kind,
      title: v.title,
      body: v.body ?? null,
      href: v.href ?? null,
    })
    .onConflict((oc) => oc.column("id").doNothing())
    .returning("id")
    .executeTakeFirst()
  return { id, created: !!row }
}
