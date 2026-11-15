/**
 * Zod schemas of comments. Shared by the form (`zodResolver`) and the Server
 * Action (`safeParse` again: actions are reachable by direct POST). Pure.
 */
import { z } from "zod"

import { COMMENT_MAX } from "./domain"

export type ValidationMessages = { required: string; tooLong: string }

export function commentSchemas(v?: Partial<ValidationMessages>) {
  const addSchema = z.object({
    body: z.string().trim().min(1, v?.required).max(COMMENT_MAX, v?.tooLong),
  })
  return { addSchema }
}

export type AddCommentInput = z.infer<ReturnType<typeof commentSchemas>["addSchema"]>
