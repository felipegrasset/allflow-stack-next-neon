import type { Answers } from "./answers"
import type { FormDefinition } from "./definition"

export const FORM_STATUSES = ["draft", "open", "closed"] as const
export type FormStatus = (typeof FORM_STATUSES)[number]

export type FormRecord = {
  id: string
  slug: string
  title: string
  status: FormStatus
  onePerPerson: boolean
  definition: FormDefinition
  createdAt: Date
}

export type ResponseRecord = { id: string; answers: Answers; createdAt: Date }
