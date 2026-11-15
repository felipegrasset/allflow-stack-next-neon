/**
 * What happens to a public submission, decided without I/O so it can be
 * tested: honeypot, open/closed, who may answer, validation. The action does
 * the I/O around it (find the form, rate limit, insert).
 */
import { validateAnswers, type AnswerErrorCode, type Answers } from "../contracts/answers"
import type { FormDefinition } from "../contracts/definition"
import type { FormStatus } from "../contracts/types"

export type SubmissionForm = {
  status: FormStatus
  onePerPerson: boolean
  definition: FormDefinition
}

export type SubmissionInput = {
  /** Value of the hidden decoy field; a person never fills it. */
  honeypot: string
  /** Signed-in user, if any. Required when the form asks for one response per person. */
  userId: string | null
  raw: Record<string, unknown>
}

export type SubmissionPlan =
  | { kind: "ignored" }
  | { kind: "rejected"; code: "closed" | "login_required" }
  | { kind: "invalid"; errors: Record<string, AnswerErrorCode> }
  | { kind: "accepted"; answers: Answers; respondentKey: string | null }

export function planSubmission(form: SubmissionForm, input: SubmissionInput): SubmissionPlan {
  // A bot that fills the decoy gets the same answer as a person, and nothing is stored.
  if (input.honeypot.trim() !== "") return { kind: "ignored" }
  if (form.status !== "open") return { kind: "rejected", code: "closed" }
  if (form.onePerPerson && !input.userId) return { kind: "rejected", code: "login_required" }
  const result = validateAnswers(form.definition, input.raw)
  if (!result.ok) return { kind: "invalid", errors: result.errors }
  return {
    kind: "accepted",
    answers: result.answers,
    respondentKey: form.onePerPerson && input.userId ? `u:${input.userId}` : null,
  }
}
