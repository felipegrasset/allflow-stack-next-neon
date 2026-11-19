import type { CodeFormInput } from "../contracts/input"

/** Initial values of the code form: what the server stored, as text. Dates as ISO instants. */
export type CodeFormValues = CodeFormInput & { code: string }

export const EMPTY_CODE_FORM: CodeFormValues = {
  code: "",
  kind: "percent",
  percent: "",
  amount: "",
  currency: "",
  minSubtotal: "",
  startsAt: "",
  endsAt: "",
  maxUses: "",
  maxUsesPerUser: "",
  note: "",
}
