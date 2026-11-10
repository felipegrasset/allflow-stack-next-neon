"use server"

import { revalidatePath } from "next/cache"

import { requireOnboardedUser } from "@/server/session"

import { markAllRead, markRead } from "./mutations"

/** Las acciones son alcanzables por POST directo: cada una llama a su guarda y solo toca filas del usuario. */
export async function markReadAction(formData: FormData): Promise<void> {
  const session = await requireOnboardedUser("/notifications")
  const id = formData.get("id")
  if (typeof id !== "string" || !id) return
  await markRead(session.user.id, id)
  // "layout" también refresca el contador de la cabecera.
  revalidatePath("/", "layout")
}

export async function markAllReadAction(): Promise<void> {
  const session = await requireOnboardedUser("/notifications")
  await markAllRead(session.user.id)
  revalidatePath("/", "layout")
}
