/**
 * Turns what a visitor sent into validated, normalized answers. Pure.
 *
 * Input is whatever the transport gave (FormData strings, a string[] for
 * repeated controls, JSON): nothing is trusted. Only fields of the
 * definition are read; extra keys are dropped. Empty values (undefined, null,
 * blank text, empty list, an unticked box) count as "not answered": an error
 * when the field is required, omitted otherwise.
 */
import { isIsoDate, resolveText, type Field, type FormDefinition } from "./definition"

export type AnswerValue = string | number | boolean | string[]
export type Answers = Record<string, AnswerValue>

export const ANSWER_ERROR_CODES = [
  "required",
  "invalid",
  "too_long",
  "too_small",
  "too_big",
  "not_option",
  "too_many",
] as const
export type AnswerErrorCode = (typeof ANSWER_ERROR_CODES)[number]

export type AnswerResult =
  | { ok: true; answers: Answers }
  | { ok: false; errors: Record<string, AnswerErrorCode> }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/

type Parsed = { skip: true } | { value: AnswerValue } | { error: AnswerErrorCode }
const SKIP: Parsed = { skip: true }

function isEmpty(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true
  if (typeof raw === "string") return raw.trim() === ""
  if (Array.isArray(raw)) return raw.length === 0 || raw.every((x) => typeof x === "string" && x.trim() === "")
  return false
}

function toNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null
  if (typeof raw === "string" && PLAIN_NUMBER.test(raw.trim())) return Number(raw.trim())
  return null
}

function parseField(field: Field, raw: unknown): Parsed {
  if (field.type === "consent") {
    const yes = raw === true || raw === "on" || raw === "true" || raw === "1"
    const no = raw === undefined || raw === null || raw === false || raw === "" || raw === "false" || raw === "off" || raw === "0"
    if (!yes && !no) return { error: "invalid" }
    if (yes) return { value: true }
    return field.required ? { error: "required" } : SKIP
  }

  if (isEmpty(raw)) return field.required ? { error: "required" } : SKIP

  switch (field.type) {
    case "text":
    case "textarea": {
      if (typeof raw !== "string") return { error: "invalid" }
      const v = raw.trim()
      return v.length > field.maxLength ? { error: "too_long" } : { value: v }
    }
    case "email": {
      if (typeof raw !== "string") return { error: "invalid" }
      const v = raw.trim().toLowerCase()
      return v.length > 254 || !EMAIL.test(v) ? { error: "invalid" } : { value: v }
    }
    case "number": {
      const n = toNumber(raw)
      if (n === null) return { error: "invalid" }
      if (field.integer && !Number.isInteger(n)) return { error: "invalid" }
      if (field.min !== undefined && n < field.min) return { error: "too_small" }
      if (field.max !== undefined && n > field.max) return { error: "too_big" }
      return { value: n }
    }
    case "scale": {
      const n = toNumber(raw)
      if (n === null || !Number.isInteger(n) || n < field.from || n > field.to) return { error: "invalid" }
      return { value: n }
    }
    case "single": {
      if (typeof raw !== "string") return { error: "invalid" }
      return field.options.some((o) => o.value === raw) ? { value: raw } : { error: "not_option" }
    }
    case "multiple": {
      const list = typeof raw === "string" ? [raw] : raw
      if (!Array.isArray(list) || list.some((x) => typeof x !== "string")) return { error: "invalid" }
      const picked = [...new Set((list as string[]).filter((x) => x.trim() !== ""))]
      if (picked.length === 0) return field.required ? { error: "required" } : SKIP
      if (!picked.every((p) => field.options.some((o) => o.value === p))) return { error: "not_option" }
      if (field.maxChoices !== undefined && picked.length > field.maxChoices) return { error: "too_many" }
      // Keep the order of the definition, not the order the client sent.
      return { value: field.options.map((o) => o.value).filter((v) => picked.includes(v)) }
    }
    case "date": {
      if (typeof raw !== "string") return { error: "invalid" }
      const v = raw.trim()
      if (!isIsoDate(v)) return { error: "invalid" }
      if (field.min !== undefined && v < field.min) return { error: "too_small" }
      if (field.max !== undefined && v > field.max) return { error: "too_big" }
      return { value: v }
    }
  }
}

/** Validates `raw` (field id → value) against the definition. */
export function validateAnswers(def: FormDefinition, raw: Record<string, unknown>): AnswerResult {
  const answers: Answers = {}
  const errors: Record<string, AnswerErrorCode> = {}
  for (const field of def.fields) {
    const given = Object.hasOwn(raw, field.id) ? raw[field.id] : undefined
    const r = parseField(field, given)
    if ("error" in r) errors[field.id] = r.error
    else if ("value" in r) answers[field.id] = r.value
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, answers }
}

/** A stored answer as readable text (option labels in the locale, yes for consent). */
export function answerText(field: Field, value: AnswerValue | undefined, locale: string, yes: string): string {
  if (value === undefined) return ""
  if (field.type === "single" && typeof value === "string")
    return resolveTextOr(field.options.find((o) => o.value === value)?.label, locale, value)
  if (field.type === "multiple" && Array.isArray(value))
    return value
      .map((v) => resolveTextOr(field.options.find((o) => o.value === v)?.label, locale, v))
      .join(", ")
  if (field.type === "consent") return value === true ? yes : ""
  return Array.isArray(value) ? value.join(", ") : String(value)
}

function resolveTextOr(label: Parameters<typeof resolveText>[0] | undefined, locale: string, fallback: string) {
  return label ? resolveText(label, locale) : fallback
}
