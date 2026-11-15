"use client"

import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { describedBy } from "@/lib/forms"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { ENTITLEMENT_KINDS, type EntitlementKind } from "../contracts/domain"
import { es } from "../messages"
import {
  createPlanAction,
  removeEntitlementAction,
  setArchivedAction,
  setDefaultPlanAction,
  setEntitlementAction,
  setPublishedAction,
  updatePlanAction,
} from "../server/admin-actions"

/**
 * The client side of /admin/plans. Every control only ASKS: the Server
 * Actions re-check session, `plan:manage`, the input (Zod) and the catalog
 * rules inside a transaction, and answer with a translated message.
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

const TEXTAREA =
  "min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30"

export type PlanFormValues = {
  id: string
  key: string
  nameEs: string
  nameEn: string
  descriptionEs: string
  descriptionEn: string
  planRef: string
  sort: number
  priceNoteEs: string
  priceNoteEn: string
}

/** Create (no `plan`) or edit a plan. The key is only typed on create. */
export function PlanForm({ plan }: { plan?: PlanFormValues }) {
  const copy = useModuleCopy(es)
  const f = copy.manage.fields
  const uid = useId()
  const [v, setV] = useState({
    key: plan?.key ?? "",
    nameEs: plan?.nameEs ?? "",
    nameEn: plan?.nameEn ?? "",
    descriptionEs: plan?.descriptionEs ?? "",
    descriptionEn: plan?.descriptionEn ?? "",
    planRef: plan?.planRef ?? "",
    sort: String(plan?.sort ?? 0),
    priceNoteEs: plan?.priceNoteEs ?? "",
    priceNoteEn: plan?.priceNoteEn ?? "",
  })
  const action = useAction()
  const fe = action.result && !action.result.ok ? action.result.fieldErrors : undefined
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }))
  // Not a whole number → NaN, which the server schema rejects as a field error.
  const sort = /^-?\d+$/.test(v.sort.trim()) ? Number(v.sort.trim()) : Number.NaN

  const fields = {
    nameEs: v.nameEs,
    nameEn: v.nameEn,
    descriptionEs: v.descriptionEs,
    descriptionEn: v.descriptionEn,
    planRef: v.planRef,
    sort,
    priceNoteEs: v.priceNoteEs,
    priceNoteEn: v.priceNoteEn,
  }

  const text = (k: Exclude<keyof typeof v, "sort">, label: string, hint?: string, max = 80) => (
    <Row id={`${uid}-${k}`} label={label} hint={hint} error={fe?.[k]}>
      {(aria) => (
        <Input {...aria} value={v[k]} onChange={set(k)} maxLength={max} readOnly={action.isPending} autoComplete="off" />
      )}
    </Row>
  )
  const area = (k: "descriptionEs" | "descriptionEn", label: string) => (
    <Row id={`${uid}-${k}`} label={label} error={fe?.[k]}>
      {(aria) => (
        <textarea {...aria} value={v[k]} onChange={set(k)} maxLength={500} readOnly={action.isPending} className={TEXTAREA} />
      )}
    </Row>
  )

  return (
    <form
      noValidate
      aria-label={plan ? copy.manage.editTitle : copy.manage.newTitle}
      aria-busy={action.isPending}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        action.run(() =>
          plan ? updatePlanAction({ planId: plan.id, ...fields }) : createPlanAction({ key: v.key, ...fields })
        )
      }}
    >
      <Feedback result={action.result} />
      <FieldGroup>
        {plan ? null : text("key", f.key, f.keyHint, 64)}
        <div className="grid gap-4 sm:grid-cols-2">
          {text("nameEs", f.nameEs)}
          {text("nameEn", f.nameEn)}
        </div>
        {area("descriptionEs", f.descriptionEs)}
        {area("descriptionEn", f.descriptionEn)}
        <Row id={`${uid}-planRef`} label={f.planRef} hint={f.planRefHint} error={fe?.planRef}>
          {(aria) => (
            <Input
              {...aria}
              value={v.planRef}
              onChange={set("planRef")}
              maxLength={200}
              spellCheck={false}
              autoComplete="off"
              readOnly={action.isPending}
            />
          )}
        </Row>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("priceNoteEs", f.priceNoteEs, f.priceNoteHint, 60)}
          {text("priceNoteEn", f.priceNoteEn, undefined, 60)}
        </div>
        <Row id={`${uid}-sort`} label={f.sort} hint={f.sortHint} error={fe?.sort}>
          {(aria) => (
            <Input {...aria} inputMode="numeric" value={v.sort} onChange={set("sort")} readOnly={action.isPending} className="sm:max-w-32" />
          )}
        </Row>
      </FieldGroup>
      <SubmitButton
        pending={action.isPending}
        label={plan ? copy.manage.save : copy.manage.create}
        pendingLabel={plan ? copy.manage.saving : copy.manage.creating}
        className="self-start"
      />
    </form>
  )
}

/**
 * Publish / stop selling, make default, archive / unarchive. Archiving the
 * default plan asks which plan replaces it (same transaction on the server).
 */
export function PlanStatusActions({
  planId,
  planLabel,
  published,
  active,
  isDefault,
  hasPlanRef,
  replacements,
}: {
  planId: string
  planLabel: string
  published: boolean
  active: boolean
  isDefault: boolean
  hasPlanRef: boolean
  replacements: { id: string; label: string }[]
}) {
  const copy = useModuleCopy(es)
  const m = copy.manage
  const uid = useId()
  const action = useAction()
  const [confirm, setConfirm] = useState(false)
  const [replacement, setReplacement] = useState("")

  const archive = () => {
    setConfirm(false)
    action.run(() =>
      setArchivedAction({ planId, archived: true, newDefaultPlanId: isDefault ? replacement || null : null })
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Feedback result={action.result} />
      <div className="flex flex-wrap gap-2">
        {published ? (
          <Button
            type="button"
            variant="outline"
            disabled={action.isPending}
            onClick={() => action.run(() => setPublishedAction({ planId, published: false }))}
          >
            {m.unpublish}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={action.isPending || !active || !hasPlanRef}
            onClick={() => action.run(() => setPublishedAction({ planId, published: true }))}
          >
            {m.publish}
          </Button>
        )}
        {!isDefault && active ? (
          <Button
            type="button"
            variant="outline"
            disabled={action.isPending}
            onClick={() => action.run(() => setDefaultPlanAction(planId))}
          >
            {m.makeDefault}
          </Button>
        ) : null}
        {active ? (
          <Button
            type="button"
            variant="ghost"
            disabled={action.isPending || (isDefault && !replacement)}
            onClick={() => setConfirm(true)}
          >
            {m.archive}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={action.isPending}
            onClick={() => action.run(() => setArchivedAction({ planId, archived: false }))}
          >
            {m.unarchive}
          </Button>
        )}
      </div>
      {published ? <p className="text-sm text-muted-foreground">{m.unpublishHint}</p> : null}
      {active ? <p className="text-sm text-muted-foreground">{m.archiveHint}</p> : null}
      {active && isDefault ? (
        replacements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{m.noReplacement}</p>
        ) : (
          <Field>
            <FieldLabel htmlFor={`${uid}-replacement`}>{m.replacement}</FieldLabel>
            <NativeSelect
              id={`${uid}-replacement`}
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              disabled={action.isPending}
              aria-describedby={`${uid}-replacement-desc`}
            >
              <NativeSelectOption value="">{m.replacementNone}</NativeSelectOption>
              {replacements.map((r) => (
                <NativeSelectOption key={r.id} value={r.id}>
                  {r.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription id={`${uid}-replacement-desc`}>{m.archiveDefaultHint}</FieldDescription>
          </Field>
        )
      ) : null}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.confirmArchiveTitle(planLabel)}</AlertDialogTitle>
            <AlertDialogDescription>{m.archiveHint}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.back}</AlertDialogCancel>
            <Button variant="destructive" onClick={archive}>
              {m.confirmArchive}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export type EntitlementFormValues = {
  key: string
  kind: EntitlementKind
  enabled: boolean
  limit: number | null
  labelEs: string
  labelEn: string
}

/** Add or change (upsert by key) one entitlement of one plan; prefilled when editing. */
export function EntitlementForm({
  planId,
  knownKeys,
  initial,
}: {
  planId: string
  knownKeys: string[]
  initial?: EntitlementFormValues
}) {
  const copy = useModuleCopy(es)
  const m = copy.manage
  const uid = useId()
  const [key, setKey] = useState(initial?.key ?? "")
  const [kind, setKind] = useState<EntitlementKind>(initial?.kind ?? "feature")
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [limit, setLimit] = useState(initial?.limit === null || initial?.limit === undefined ? "" : String(initial.limit))
  const [labelEs, setLabelEs] = useState(initial?.labelEs ?? "")
  const [labelEn, setLabelEn] = useState(initial?.labelEn ?? "")
  const action = useAction()
  const fe = action.result && !action.result.ok ? action.result.fieldErrors : undefined
  // Empty = unlimited; anything that is not a whole number goes as NaN and the server rejects it.
  const parsedLimit = limit.trim() === "" ? null : /^\d+$/.test(limit.trim()) ? Number(limit.trim()) : Number.NaN

  return (
    <form
      noValidate
      aria-label={m.entitlementTitle}
      aria-busy={action.isPending}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        action.run(() =>
          setEntitlementAction({
            planId,
            key,
            kind,
            enabled: kind === "feature" ? enabled : false,
            limit: kind === "limit" ? parsedLimit : null,
            labelEs,
            labelEn,
          })
        )
      }}
    >
      <Feedback result={action.result} />
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Row id={`${uid}-key`} label={m.key} hint={m.keyHint} error={fe?.key}>
            {(aria) => (
              <>
                <Input
                  {...aria}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  list={`${uid}-keys`}
                  autoComplete="off"
                  spellCheck={false}
                  readOnly={action.isPending || Boolean(initial)}
                />
                <datalist id={`${uid}-keys`}>
                  {knownKeys.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
              </>
            )}
          </Row>
          <Row id={`${uid}-kind`} label={m.kind} error={fe?.kind}>
            {(aria) => (
              <NativeSelect
                {...aria}
                value={kind}
                onChange={(e) => setKind(e.target.value as EntitlementKind)}
                disabled={action.isPending}
              >
                {ENTITLEMENT_KINDS.map((k) => (
                  <NativeSelectOption key={k} value={k}>
                    {m.kinds[k]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </Row>
        </div>
        {kind === "feature" ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={action.isPending}
              className="size-4 accent-primary"
            />
            {m.enabled}
          </label>
        ) : (
          <Row id={`${uid}-limit`} label={m.limit} hint={m.limitHint} error={fe?.limit}>
            {(aria) => (
              <Input {...aria} inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} readOnly={action.isPending} />
            )}
          </Row>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Row id={`${uid}-labelEs`} label={m.labelEs} error={fe?.labelEs}>
            {(aria) => <Input {...aria} value={labelEs} maxLength={80} onChange={(e) => setLabelEs(e.target.value)} readOnly={action.isPending} />}
          </Row>
          <Row id={`${uid}-labelEn`} label={m.labelEn} error={fe?.labelEn}>
            {(aria) => <Input {...aria} value={labelEn} maxLength={80} onChange={(e) => setLabelEn(e.target.value)} readOnly={action.isPending} />}
          </Row>
        </div>
      </FieldGroup>
      <SubmitButton
        pending={action.isPending}
        label={m.saveEntitlement}
        pendingLabel={m.saving}
        className="self-start"
      />
    </form>
  )
}

/** "Remove" one entitlement, after a confirmation that says who loses it. */
export function RemoveEntitlementButton({ planId, entKey }: { planId: string; entKey: string }) {
  const copy = useModuleCopy(es)
  const m = copy.manage
  const action = useAction()
  const [open, setOpen] = useState(false)
  return (
    <>
      <SubmitButton
        type="button"
        variant="ghost"
        pending={action.isPending}
        label={m.removeEntitlement}
        pendingLabel={m.removing}
        onClick={() => setOpen(true)}
      />
      {action.result && !action.result.ok ? <Feedback result={action.result} /> : null}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.confirmRemoveTitle(entKey)}</AlertDialogTitle>
            <AlertDialogDescription>{m.confirmRemove}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.back}</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                setOpen(false)
                action.run(() => removeEntitlementAction({ planId, key: entKey }))
              }}
            >
              {m.removeEntitlement}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
