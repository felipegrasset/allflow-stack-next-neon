/**
 * Zod schemas of the module. Factories over the validation texts so a screen
 * passes its locale's copy; called with no argument they use the Spanish
 * source (what `contracts/` uses when another module calls it).
 */
import { z } from "zod"

import { es } from "../messages"
import { schedulesOverlap } from "../server/slots"
import { isValidTimeZone, parseYmd } from "../server/time"
import { RESOURCE_KINDS } from "./types"

export type ValidationMessages = {
  [K in keyof typeof es.bookings.validation]: string
}

const id = (msg: string) => z.string().trim().min(1, msg).max(200, msg)

export function bookingSchemas(v: ValidationMessages = es.bookings.validation) {
  const note = z
    .string()
    .trim()
    .max(500, v.note)
    .optional()
    .transform((s) => (s ? s : undefined))

  const availabilityInput = z.object({
    resourceId: id(v.resource),
    /** First day, "YYYY-MM-DD", in the resource's zone. */
    from: z.string().refine((s) => parseYmd(s) !== null, { message: v.date }),
    days: z.number().int().min(1, v.days).max(31, v.days).default(1),
  })

  const createBookingInput = z.object({
    resourceId: id(v.resource),
    userId: id(v.user),
    startsAt: z.coerce
      .date({ message: v.slot })
      .refine((d) => !Number.isNaN(d.getTime()), { message: v.slot }),
    note,
  })

  const cancelBookingInput = z.object({
    bookingId: id(v.booking),
    byUserId: id(v.user),
    /** The caller already checked `booking: manage`: may cancel anyone's, also once started. */
    asManager: z.boolean().default(false),
  })

  const resourceInput = z.object({
    id: z.string().trim().min(1).max(200).optional(),
    name: z.string().trim().min(1, v.name).max(120, v.name),
    kind: z.enum(RESOURCE_KINDS).default("service"),
    details: z.string().trim().max(500, v.details).optional(),
    timezone: z.string().refine(isValidTimeZone, { message: v.timezone }),
    slotMinutes: z.number().int().min(5, v.slotMinutes).max(720, v.slotMinutes).default(60),
    active: z.boolean().default(true),
  })

  const openingInterval = z
    .object({
      weekday: z.number().int().min(0, v.weekday).max(6, v.weekday),
      startMinute: z.number().int().min(0, v.minutes).max(1439, v.minutes),
      endMinute: z.number().int().min(1, v.minutes).max(1440, v.minutes),
    })
    .refine((s) => s.endMinute > s.startMinute, { message: v.minutes })

  const weeklySchedule = z
    .array(openingInterval)
    .max(70)
    .refine((list) => !schedulesOverlap(list), { message: v.scheduleOverlap })

  /** What the booking form sends (the user comes from the session, never from the form). */
  const bookingForm = z.object({
    resourceId: id(v.resource),
    startsAt: z
      .string()
      .min(1, v.slot)
      .refine((s) => !Number.isNaN(new Date(s).getTime()), { message: v.slot }),
    note: z.string().trim().max(500, v.note),
  })

  return {
    availabilityInput,
    createBookingInput,
    cancelBookingInput,
    resourceInput,
    weeklySchedule,
    bookingForm,
  }
}

const source = bookingSchemas()
export const availabilityInputSchema = source.availabilityInput
export const createBookingInputSchema = source.createBookingInput
export const cancelBookingInputSchema = source.cancelBookingInput
export const resourceInputSchema = source.resourceInput
export const weeklyScheduleSchema = source.weeklySchedule
export const bookingFormSchema = source.bookingForm

export type AvailabilityInput = z.input<typeof availabilityInputSchema>
export type CreateBookingInput = z.input<typeof createBookingInputSchema>
export type CancelBookingInput = z.input<typeof cancelBookingInputSchema>
export type ResourceInput = z.input<typeof resourceInputSchema>
export type WeeklyScheduleInput = z.input<typeof weeklyScheduleSchema>
export type BookingFormInput = z.input<typeof bookingFormSchema>
