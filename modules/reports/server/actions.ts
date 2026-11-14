"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireReportPermission } from "./access"
import { moveCardIn, removeCardIn } from "./edit"
import { editDashboard } from "./mutations"

const ref = z.object({
  dashboardId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
  cardId: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,62}$/),
})
const move = ref.extend({ direction: z.enum(["up", "down"]) })

/** Reachable by direct POST: each action checks session + `report:edit` before touching data. */
export async function moveCardAction(formData: FormData): Promise<void> {
  await requireReportPermission("edit", "/reports")
  const input = move.safeParse(Object.fromEntries(formData))
  if (!input.success) return
  const { dashboardId, cardId, direction } = input.data
  await editDashboard(dashboardId, (d) => moveCardIn(d, cardId, direction))
  revalidatePath(`/reports/${dashboardId}`)
}

export async function removeCardAction(formData: FormData): Promise<void> {
  await requireReportPermission("edit", "/reports")
  const input = ref.safeParse(Object.fromEntries(formData))
  if (!input.success) return
  const { dashboardId, cardId } = input.data
  await editDashboard(dashboardId, (d) => removeCardIn(d, cardId))
  revalidatePath(`/reports/${dashboardId}`)
}
