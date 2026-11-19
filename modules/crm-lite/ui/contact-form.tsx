"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { CONTACT_STATUSES, type Contact } from "../contracts/domain"
import { crmSchemas, type ContactInput } from "../contracts/input"
import { es } from "../messages"
import { createContactAction, updateContactAction } from "../server/actions"
import { FormField, TEXTAREA_CLASS } from "./fields"

/** Create (no `contact`) or edit a contact. */
export function ContactForm({ contact }: { contact?: Contact }) {
  const copy = useModuleCopy(es)
  const { contactSchema } = useMemo(
    () => crmSchemas(copy.validation),
    [copy]
  )
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState<string | null>(null)
  const prefix = contact ? "crm-contact-edit" : "crm-contact-new"
  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    mode: "onBlur",
    defaultValues: {
      name: contact?.name ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      company: contact?.company ?? "",
      status: contact?.status ?? "lead",
      notes: contact?.notes ?? "",
    },
  })

  const onSubmit = handleSubmit((values) => {
    clearErrors("root.serverError")
    setSaved(null)
    startTransition(async () => {
      const res = contact
        ? await updateContactAction(contact.id, values)
        : await createContactAction(values)
      if (res.ok) {
        if (res.redirectTo) router.push(res.redirectTo)
        else {
          reset(values)
          setSaved(res.message ?? copy.actions.saved)
        }
        return
      }
      let focused = false
      for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
        if (!message) continue
        setError(
          name as keyof ContactInput,
          { message },
          { shouldFocus: !focused }
        )
        focused = true
      }
      if (res.formError) setError("root.serverError", { message: res.formError })
    })
  })

  const text = (
    name: "name" | "email" | "phone" | "company",
    label: string,
    extra: React.ComponentProps<"input"> = {}
  ) => (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <FormField id={`${prefix}-${name}`} label={label} fieldState={fieldState}>
          {(aria) => (
            <Input {...field} {...aria} {...extra} readOnly={isPending} />
          )}
        </FormField>
      )}
    />
  )

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4"
      aria-label={contact ? copy.contact.editTitle : copy.contacts.newTitle}
    >
      {errors.root?.serverError ? (
        <FormAlert>{errors.root.serverError.message}</FormAlert>
      ) : null}
      {saved ? <FormAlert variant="success">{saved}</FormAlert> : null}
      <FieldGroup>
        {text("name", copy.fields.name, { autoComplete: "off" })}
        {text("email", copy.fields.email, {
          type: "email",
          inputMode: "email",
          autoComplete: "off",
        })}
        {text("phone", copy.fields.phone, { type: "tel", autoComplete: "off" })}
        {text("company", copy.fields.company, { autoComplete: "off" })}
        <Controller
          name="status"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              id={`${prefix}-status`}
              label={copy.fields.status}
              fieldState={fieldState}
            >
              {(aria) => (
                <NativeSelect {...field} {...aria} disabled={isPending}>
                  {CONTACT_STATUSES.map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {copy.statuses[s]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          )}
        />
        <Controller
          name="notes"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              id={`${prefix}-notes`}
              label={copy.fields.notes}
              fieldState={fieldState}
            >
              {(aria) => (
                <textarea
                  {...field}
                  {...aria}
                  rows={3}
                  readOnly={isPending}
                  className={TEXTAREA_CLASS}
                />
              )}
            </FormField>
          )}
        />
      </FieldGroup>
      <SubmitButton
        pending={isPending}
        label={contact ? copy.actions.save : copy.actions.create}
        pendingLabel={contact ? copy.actions.saving : copy.actions.creating}
        className="self-start"
      />
    </form>
  )
}
