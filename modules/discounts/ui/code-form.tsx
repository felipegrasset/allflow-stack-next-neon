"use client"

import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { describedBy } from "@/lib/forms"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import type { CodeFormInput } from "../contracts/input"
import { DISCOUNT_KINDS, type DiscountKind } from "../contracts/types"
import { es } from "../messages"
import { createCodeAction, setActiveAction, updateCodeAction } from "../server/admin-actions"
import type { CodeFormValues } from "./code-form-values"

/**
 * The client side of /admin/discounts. Every control only ASKS: the Server
 * Actions re-check session, `discount:manage` and the input (Zod + the same
 * rules the database checks). Amounts travel as typed text and are parsed on
 * the server with the code's currency.
 *
 * Dates: the inputs are in the browser's local time and are sent as ISO
 * instants. That conversion needs the browser's time zone, so this form is
 * rendered only in the browser (see code-form-loader.tsx), never on the
 * server: no hydration mismatch.
 */

type Result =
  | { ok: true; message?: string; redirectTo?: string }
  | { ok: false; formError?: string; fieldErrors?: Partial<Record<string, string>> }

function useAction() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<Result | null>(null)
  const run = (fn: () => Promise<Result>) => {
    setResult(null)
    startTransition(async () => {
      const res = await fn()
      setResult(res)
      if (res.ok && res.redirectTo?.startsWith("/")) router.push(res.redirectTo)
      else if (res.ok) router.refresh()
    })
  }
  return { isPending, result, run }
}

function Feedback({ result }: { result: Result | null }) {
  if (!result) return null
  if (result.ok) return result.message ? <FormAlert variant="success">{result.message}</FormAlert> : null
  return result.formError ? <FormAlert>{result.formError}</FormAlert> : null
}

type Aria = { id: string; "aria-invalid": true | undefined; "aria-describedby": string | undefined }

function Row({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: (aria: Aria) => React.ReactNode
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy(hint && `${id}-desc`, error && `${id}-err`),
      })}
      {hint ? <FieldDescription id={`${id}-desc`}>{hint}</FieldDescription> : null}
      {error ? <FieldError id={`${id}-err`}>{error}</FieldError> : null}
    </Field>
  )
}

/** ISO instant → value of a datetime-local input, in the browser's time zone. */
function toLocalInput(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** datetime-local value (browser time) → ISO instant; "" stays "", garbage becomes "x" (server rejects it). */
function toIso(local: string): string {
  if (!local) return ""
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? "x" : d.toISOString()
}

/** Create (no `codeId`) or edit a code. The code text is only typed on create. */
export function CodeForm({ codeId, initial }: { codeId?: string; initial: CodeFormValues }) {
  const copy = useModuleCopy(es)
  const a = copy.admin
  const f = a.fields
  const uid = useId()
  const [v, setV] = useState({
    ...initial,
    startsAt: toLocalInput(initial.startsAt),
    endsAt: toLocalInput(initial.endsAt),
  })
  const [active, setActive] = useState(true)
  const action = useAction()
  const fe = action.result && !action.result.ok ? action.result.fieldErrors : undefined
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }))

  const input = (k: Exclude<keyof typeof v, "kind">, label: string, hint?: string, extra?: React.ComponentProps<typeof Input>) => (
    <Row id={`${uid}-${k}`} label={label} hint={hint} error={fe?.[k]}>
      {(aria) => (
        <Input
          {...aria}
          value={v[k]}
          onChange={set(k)}
          readOnly={action.isPending}
          autoComplete="off"
          spellCheck={false}
          {...extra}
        />
      )}
    </Row>
  )

  return (
    <form
      noValidate
      aria-label={codeId ? a.editTitle : a.newTitle}
      aria-busy={action.isPending}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        const fields: CodeFormInput = {
          kind: v.kind,
          percent: v.percent,
          amount: v.amount,
          currency: v.currency.trim(),
          minSubtotal: v.minSubtotal,
          startsAt: toIso(v.startsAt),
          endsAt: toIso(v.endsAt),
          maxUses: v.maxUses.trim(),
          maxUsesPerUser: v.maxUsesPerUser.trim(),
          note: v.note,
        }
        action.run(() =>
          codeId ? updateCodeAction({ codeId, ...fields }) : createCodeAction({ code: v.code, active, ...fields })
        )
      }}
    >
      <Feedback result={action.result} />
      <FieldGroup>
        {codeId ? null : input("code", f.code, f.codeHint, { maxLength: 60, className: "uppercase" })}
        <Row id={`${uid}-kind`} label={f.kind} error={fe?.kind}>
          {(aria) => (
            <NativeSelect
              {...aria}
              value={v.kind}
              disabled={action.isPending}
              onChange={(e) => setV((s) => ({ ...s, kind: e.target.value as DiscountKind }))}
            >
              {DISCOUNT_KINDS.map((k) => (
                <NativeSelectOption key={k} value={k}>
                  {a.kinds[k]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </Row>
        <div className="grid gap-4 sm:grid-cols-2">
          {v.kind === "percent"
            ? input("percent", f.percent, f.percentHint, { inputMode: "decimal", maxLength: 10 })
            : input("amount", f.amount, f.amountHint, { inputMode: "decimal", maxLength: 30 })}
          {input("currency", f.currency, f.currencyHint, { maxLength: 3, className: "uppercase" })}
        </div>
        {input("minSubtotal", f.minSubtotal, f.minSubtotalHint, { inputMode: "decimal", maxLength: 30 })}
        <div className="grid gap-4 sm:grid-cols-2">
          {input("startsAt", f.startsAt, f.datesHint, { type: "datetime-local" })}
          {input("endsAt", f.endsAt, undefined, { type: "datetime-local" })}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {input("maxUses", f.maxUses, f.capsHint, { inputMode: "numeric", maxLength: 7 })}
          {input("maxUsesPerUser", f.maxUsesPerUser, undefined, { inputMode: "numeric", maxLength: 7 })}
        </div>
        {input("note", f.note, f.noteHint, { maxLength: 200, spellCheck: true })}
        {codeId ? null : (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={action.isPending}
              className="size-4 accent-primary"
            />
            <span>{f.active}</span>
          </label>
        )}
      </FieldGroup>
      <SubmitButton
        pending={action.isPending}
        label={codeId ? a.save : a.create}
        pendingLabel={a.saving}
        className="self-start"
      />
    </form>
  )
}

/** Activate / deactivate a code. A deactivated code answers like an unknown one. */
export function ActiveToggle({ codeId, active }: { codeId: string; active: boolean }) {
  const copy = useModuleCopy(es)
  const action = useAction()
  return (
    <div className="flex flex-col gap-2">
      <Feedback result={action.result} />
      <SubmitButton
        type="button"
        variant={active ? "outline" : "default"}
        pending={action.isPending}
        label={active ? copy.admin.deactivate : copy.admin.activate}
        pendingLabel={copy.admin.saving}
        onClick={() => action.run(() => setActiveAction({ codeId, active: !active }))}
        className="self-start"
      />
    </div>
  )
}
