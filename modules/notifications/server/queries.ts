import { getKysely } from "@/server/db/pool"

import type { Notification } from "../contracts/input"

/** Las más recientes de la persona (no leídas primero no: el orden es cronológico). */
export async function listNotifications(
  userId: string,
  limit = 50
): Promise<Notification[]> {
  const rows = await getKysely()
    .selectFrom("notifications")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .limit(limit)
    .execute()
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    href: r.href,
    readAt: r.read_at,
    createdAt: r.created_at,
  }))
}

export async function countUnread(userId: string): Promise<number> {
  const row = await getKysely()
    .selectFrom("notifications")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("user_id", "=", userId)
    .where("read_at", "is", null)
    .executeTakeFirstOrThrow()
  return Number(row.n)
}
