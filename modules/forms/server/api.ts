import { slugSchema, defineForm, type FormDefinitionInput } from "../contracts/definition"
import { FormError } from "../contracts/errors"
import { insertForm, isUniqueViolation } from "./store"

/**
 * Creates a form (validates the definition and the slug). Server-only. It does
 * NOT check permissions: whoever calls it (a seed, another module's setup, an
 * action that already checked `form:write`) decides who may create forms.
 * Starts as a draft unless `status` says otherwise.
 */
export async function createForm(input: {
  slug: string
  definition: FormDefinitionInput
  onePerPerson?: boolean
  status?: "draft" | "open"
  createdBy?: string | null
}): Promise<{ id: string; slug: string }> {
  const slug = slugSchema.safeParse(input.slug)
  if (!slug.success) throw new FormError("invalid_input", "invalid slug")
  const definition = defineForm(input.definition)
  try {
    return await insertForm({
      slug: slug.data,
      definition,
      onePerPerson: input.onePerPerson ?? false,
      status: input.status ?? "draft",
      createdBy: input.createdBy ?? null,
    })
  } catch (e) {
    if (isUniqueViolation(e)) throw new FormError("slug_taken")
    throw e
  }
}
