/** Result of the article editor's Server Actions (a plain value, no "use server" here). */
export type ArticleFormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<string, string>> }

export type FeedbackState =
  | { status: "idle" }
  | { status: "ok"; helpful: boolean }
  | { status: "error"; message: string }
