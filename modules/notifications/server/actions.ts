"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireOnboardedUser } from "@/server/session"

import { markAllRead, markRead } from "./mutations"

/** Same bounds as the `id` accepted by `notify()`. */
const idSchema = z.string().min(1).max(200)

/** Las acciones son alcanzables por POST directo: cada una llama a su guarda y solo toca filas del usuario. */
export async function markReadAction(formData: FormData): Promise<void> {
  const session = await requireOnboardedUser("/notifications")
  const id = idSchema.safeParse(formData.get("id"))
  if (!id.success) return
  await markRead(session.user.id, id.data)
  // "layout" también refresca el contador de la cabecera.
  revalidatePath("/", "layout")
}

export async function markAllReadAction(): Promise<void> {
  const session = await requireOnboardedUser("/notifications")
  await markAllRead(session.user.id)
  revalidatePath("/", "layout")
}
