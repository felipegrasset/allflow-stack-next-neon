"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import type { FormResult } from "@/lib/schemas/auth"
import { getKysely } from "@/server/db/pool"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { es } from "../messages"
import { actionSession } from "./guard"
import { setEnabledWith } from "./store"

const inputSchema = z.object({ enabled: z.boolean() })

/**
 * Reachable by direct POST: session + `notificationEmail:manage` BEFORE
 * anything else, Zod on the input, and the write is always about the
 * signed-in person (the id never comes from the client).
 */
export async function saveEmailPreferenceAction(input: { enabled: boolean }): Promise<FormResult<"enabled">> {
  const session = await actionSession("/settings/notifications")
  const copy = await getModuleCopy(es)
  if (!session) return { ok: false, formError: copy.errors.forbidden }
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, formError: copy.errors.invalid }
  try {
    await setEnabledWith(getKysely(), session.user.id, parsed.data.enabled)
    revalidatePath("/settings/notifications")
    return { ok: true, message: copy.form.saved }
  } catch (err) {
    console.error("[notifications-email] saveEmailPreferenceAction failed", err)
    return { ok: false, formError: copy.errors.generic }
  }
}
