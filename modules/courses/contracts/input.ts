/**
 * Zod schemas of courses. One per form, shared by the client and the Server
 * Action (`safeParse` again: actions are reachable by direct POST). Factories
 * because the error texts depend on the locale: pass `copy.validation`.
 * Pure: no `@/` imports.
 */
import { z } from "zod"

import { parseMeetingUrl } from "./domain"

export type ValidationMessages = {
  required: string
  tooLong: string
  invalid: string
  invalidUrl: string
  invalidDate: string
  invalidEmail: string
}

export function courseSchemas(v?: Partial<ValidationMessages>) {
  const required = (max: number) => z.string().trim().min(1, v?.required).max(max, v?.tooLong)

  const courseSchema = z.object({
    title: required(160),
    summary: z.string().trim().max(300, v?.tooLong),
    description: z.string().trim().max(20000, v?.tooLong),
  })

  const lessonSchema = z.object({
    title: required(160),
    body: z.string().trim().max(20000, v?.tooLong),
    position: z.number(v?.invalid).int(v?.invalid).min(0, v?.invalid).max(9999, v?.invalid),
    meetingUrl: z
      .string()
      .trim()
      .max(2000, v?.tooLong)
      .refine((s) => parseMeetingUrl(s).ok, v?.invalidUrl)
      .transform((s) => {
        const r = parseMeetingUrl(s)
        return r.ok ? r.url : null
      }),
    startsAt: z
      .string()
      .trim()
      .max(40, v?.invalidDate)
      .refine((s) => s === "" || !Number.isNaN(new Date(s).getTime()), v?.invalidDate)
      .transform((s) => (s === "" ? null : new Date(s))),
  })

  const enrollSchema = z.object({
    email: z.string().trim().toLowerCase().max(254, v?.tooLong).pipe(z.email(v?.invalidEmail)),
  })
  const idSchema = z.object({ id: z.string().min(1, v?.invalid).max(100, v?.invalid) })
  return { courseSchema, lessonSchema, enrollSchema, idSchema }
}

type Schemas = ReturnType<typeof courseSchemas>
export type CourseInput = z.output<Schemas["courseSchema"]>
export type LessonInput = z.output<Schemas["lessonSchema"]>
