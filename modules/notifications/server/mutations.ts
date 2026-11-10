import { getKysely } from "@/server/db/pool"

/** Marca una como leída. Solo si es de `userId`; devuelve si cambió algo. */
export async function markRead(userId: string, id: string): Promise<boolean> {
  const res = await getKysely()
    .updateTable("notifications")
    .set({ read_at: new Date() })
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .where("read_at", "is", null)
    .executeTakeFirst()
  return Number(res.numUpdatedRows) > 0
}

/** Marca todas las de `userId`; devuelve cuántas cambió. */
export async function markAllRead(userId: string): Promise<number> {
  const res = await getKysely()
    .updateTable("notifications")
    .set({ read_at: new Date() })
    .where("user_id", "=", userId)
    .where("read_at", "is", null)
    .executeTakeFirst()
  return Number(res.numUpdatedRows)
}
