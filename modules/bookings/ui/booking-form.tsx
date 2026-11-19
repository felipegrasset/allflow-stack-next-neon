"use client"

import { useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { describedBy } from "@/lib/forms"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { bookingSchemas, type BookingFormInput } from "../contracts/input"
import { es } from "../messages"
import { createBookingAction } from "../server/actions"

export type SlotOption = { value: string; label: string }

/**
 * Pick a free slot and book it. Field + Controller, one Zod schema on both
 * sides (the action re-validates), server errors mounted with setError. A slot
 * someone took meanwhile comes back as an error on the slot field and the
 * availability is refreshed.
 */
export function BookingForm({
  resourceId,
  slots,
  zone,
  slotMinutes,
  successHref,
}: {
  resourceId: string
  slots: SlotOption[]
  /** Zone label shown with the times, e.g. "GMT-3". */
  zone: string
  slotMinutes: number
  successHref: string
}) {
  const copy = useModuleCopy(es)
  const { bookingForm } = useMemo(() => bookingSchemas(copy.validation), [copy])
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<BookingFormInput>({
    resolver: zodResolver(bookingForm),
    mode: "onBlur",
    defaultValues: { resourceId, startsAt: "", note: "" },
  })

  const onSubmit = handleSubmit((values) => {
    clearErrors("root.serverError")
    startTransition(async () => {
      const res = await createBookingAction(values)
      if (res.ok) {
        router.push(successHref)
        return
      }
      if (res.fieldErrors?.startsAt) {
        setError("startsAt", { message: res.fieldErrors.startsAt }, { shouldFocus: true })
        router.refresh()
      }
      if (res.fieldErrors?.note)
        setError("note", { message: res.fieldErrors.note }, { shouldFocus: true })
      if (res.formError) setError("root.serverError", { message: res.formError })
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6" aria-label={copy.form.label}>
      {errors.root?.serverError && <FormAlert>{errors.root.serverError.message}</FormAlert>}

      <FieldGroup>
        <Controller
          name="startsAt"
          control={control}
          render={({ field, fieldState }) => (
            <FieldSet
              data-invalid={fieldState.invalid || undefined}
              aria-describedby={describedBy("slots-description", fieldState.invalid && "slots-error")}
              aria-invalid={fieldState.invalid || undefined}
            >
              <FieldLegend variant="label">{copy.form.slots}</FieldLegend>
              <FieldDescription id="slots-description">
                {copy.form.slotsHelp(zone, slotMinutes)}
              </FieldDescription>
              <div role="radiogroup" className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2">
                {slots.map((s, i) => {
                  const id = `slot-${i}`
                  return (
                    <label
                      key={s.value}
                      htmlFor={id}
                      className="flex cursor-pointer items-center justify-center rounded-lg border border-border px-3 py-2 text-sm tabular-nums transition-colors hover:bg-muted has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                    >
                      <input
                        id={id}
                        type="radio"
                        className="sr-only"
                        name={field.name}
                        value={s.value}
                        checked={field.value === s.value}
                        onChange={() => field.onChange(s.value)}
                        onBlur={field.onBlur}
                        disabled={isPending}
                        ref={i === 0 ? field.ref : undefined}
                      />
                      {s.label}
                    </label>
                  )
                })}
              </div>
              {fieldState.invalid && <FieldError id="slots-error">{fieldState.error?.message}</FieldError>}
            </FieldSet>
          )}
        />

        <Controller
          name="note"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid || undefined}>
              <FieldLabel htmlFor="note">{copy.form.note}</FieldLabel>
              <Input
                {...field}
                id="note"
                maxLength={500}
                readOnly={isPending}
                aria-invalid={fieldState.invalid || undefined}
                aria-describedby={describedBy("note-description", fieldState.invalid && "note-error")}
              />
              <FieldDescription id="note-description">{copy.form.noteHelp}</FieldDescription>
              {fieldState.invalid && <FieldError id="note-error">{fieldState.error?.message}</FieldError>}
            </Field>
          )}
        />
      </FieldGroup>

      <SubmitButton
        pending={isPending}
        label={copy.form.submit}
        pendingLabel={copy.form.submitting}
        className="self-start"
      />
    </form>
  )
}
