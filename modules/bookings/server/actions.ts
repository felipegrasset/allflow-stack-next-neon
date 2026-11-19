"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ZodError } from "zod"

import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { requireOnboardedUser } from "@/server/session"

import { cancelBooking, createBooking } from "../contracts"
import { bookingSchemas, type BookingFormInput } from "../contracts/input"
import { isBookingError } from "../contracts/types"
import { es } from "../messages"
import { canBooking } from "./access"

export type BookingFormResult =
  | { ok: true; bookingId: string }
  | {
      ok: false
      formError?: string
      fieldErrors?: Partial<Record<"startsAt" | "resourceId" | "note", string>>
    }

/**
 * Books a slot for the signed-in person. Reachable by direct POST: checks the
 * session and `booking: create`, re-validates with the same schema as the
 * form, and takes the user from the session, never from the input.
 */
export async function createBookingAction(input: BookingFormInput): Promise<BookingFormResult> {
  const session = await requireOnboardedUser("/bookings/new")
  const copy = await getModuleCopy(es)
  if (!(await canBooking("create"))) return { ok: false, formError: copy.errors.forbidden }

  const parsed = bookingSchemas(copy.validation).bookingForm.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Partial<Record<"startsAt" | "resourceId" | "note", string>> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (key === "startsAt" || key === "resourceId" || key === "note")
        fieldErrors[key] ??= issue.message
    }
    return { ok: false, fieldErrors }
  }

  try {
    const booking = await createBooking({
      resourceId: parsed.data.resourceId,
      startsAt: parsed.data.startsAt,
      note: parsed.data.note,
      userId: session.user.id,
    })
    revalidatePath("/bookings")
    revalidatePath("/reservar")
    return { ok: true, bookingId: booking.id }
  } catch (e) {
    if (isBookingError(e)) {
      const message = copy.errors[e.code]
      if (e.code === "slotTaken" || e.code === "outsideSchedule" || e.code === "inThePast")
        return { ok: false, fieldErrors: { startsAt: message } }
      return { ok: false, formError: message }
    }
    if (e instanceof ZodError) return { ok: false, formError: copy.errors.generic }
    console.error("[bookings] create failed", e)
    return { ok: false, formError: copy.errors.generic }
  }
}

const cancelSchema = z.object({ bookingId: z.string().min(1).max(200) })

/**
 * Cancels a booking (form action). Its owner needs `booking: cancel`; someone
 * else's needs `booking: manage`. A refused or invalid request changes nothing.
 */
export async function cancelBookingAction(formData: FormData): Promise<void> {
  const session = await requireOnboardedUser("/bookings")
  const parsed = cancelSchema.safeParse({ bookingId: formData.get("bookingId") })
  if (!parsed.success) return
  const [canCancel, canManage] = await Promise.all([
    canBooking("cancel"),
    canBooking("manage"),
  ])
  if (!canCancel && !canManage) return
  try {
    await cancelBooking({
      bookingId: parsed.data.bookingId,
      byUserId: session.user.id,
      asManager: canManage,
    })
  } catch (e) {
    if (!isBookingError(e)) console.error("[bookings] cancel failed", e)
    return
  }
  revalidatePath("/bookings")
  revalidatePath("/reservar")
}
