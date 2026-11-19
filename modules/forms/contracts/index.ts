/**
 * The only thing another module may import from `forms`:
 *
 *   import { createForm, defineForm, validateAnswers } from "@/modules/forms/contracts"
 *
 *   await createForm({ slug: "feedback", status: "open", definition: { title: "Feedback", fields: [...] } })
 *
 * `createForm` is server-only and does not check permissions. Everything else
 * here is pure (definition schema, answer validation, aggregation).
 */
export { createForm } from "../server/api"
export {
  ANSWER_ERROR_CODES,
  answerText,
  validateAnswers,
  type AnswerErrorCode,
  type AnswerResult,
  type AnswerValue,
  type Answers,
} from "./answers"
export {
  FIELD_TYPES,
  defineForm,
  describeIssues,
  fieldSchema,
  formDefinitionSchema,
  isIsoDate,
  resolveText,
  slugSchema,
  type Field,
  type FieldInput,
  type FieldType,
  type FormDefinition,
  type FormDefinitionInput,
  type LocalizedText,
} from "./definition"
export { FORM_ERROR_CODES, FormError, isFormError, type FormErrorCode } from "./errors"
export { summarize, type FieldSummary, type FormSummary } from "./summary"
export { FORM_STATUSES, type FormRecord, type FormStatus, type ResponseRecord } from "./types"
