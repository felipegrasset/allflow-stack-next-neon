/** Result of the Server Actions used with `useActionState` (a plain value, no "use server" here). */
export type FormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<string, string>> }
