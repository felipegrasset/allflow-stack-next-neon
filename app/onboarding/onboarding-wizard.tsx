"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import { toast } from "@/components/ui/toast"
import { profileCopy } from "@/lib/copy/profile"
import { describedBy } from "@/lib/forms"
import { LOCALES, onboardingSchema, onboardingSteps, type OnboardingInput } from "@/lib/schemas/profile"
import { completeOnboardingAction, saveOnboardingStepAction } from "./actions"

const c = profileCopy.onboarding

/**
 * Multi-step onboarding. One react-hook-form for all steps, so going back
 * keeps what was typed; each step is saved on "Next", so a reload keeps it too.
 * "Next" validates the step's fields, saves them (Server Action), and only
 * then advances. "Skip" marks the user onboarded without saving.
 */
export function OnboardingWizard({ initial, initialStep = 0 }: { initial: OnboardingInput; initialStep?: number }) {
  const router = useRouter()
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 0), onboardingSteps.length - 1))
  const [isSaving, startSaving] = useTransition()
  const [isSkipping, startSkipping] = useTransition()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)

  const {
    control,
    trigger,
    getValues,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    mode: "onBlur",
    defaultValues: initial,
  })

  // Keep the step in the URL (?paso=2): a reload lands on the same step, and
  // the values of the steps already done come back from the server (each
  // step is saved when you leave it).
  useEffect(() => {
    const url = new URL(location.href)
    url.searchParams.set("paso", String(step + 1))
    history.replaceState(history.state, "", url)
  }, [step])

  // Move focus to the new step's heading so screen readers announce it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [step])

  const current = onboardingSteps[step]
  const total = onboardingSteps.length
  const isLast = step === total - 1
  const busy = isSaving || isSkipping

  const next = () => {
    clearErrors("root.serverError")
    startSaving(async () => {
      if (!(await trigger([...current.fields], { shouldFocus: true }))) return
      const res = await saveOnboardingStepAction(step, getValues())
      if (!res.ok) {
        let first = true
        for (const [field, message] of Object.entries(res.fieldErrors ?? {})) {
          setError(field as keyof OnboardingInput, { message }, { shouldFocus: first })
          first = false
        }
        if (res.formError) setError("root.serverError", { message: res.formError })
        return
      }
      setStep((s) => s + 1)
    })
  }

  const finish = (skip: boolean) => {
    clearErrors("root.serverError")
    const run = skip ? startSkipping : startSaving
    run(async () => {
      const res = await completeOnboardingAction()
      if (!res.ok) {
        if (res.formError) setError("root.serverError", { message: res.formError })
        return
      }
      if (!skip) toast.add({ title: c.finished, type: "success" })
      router.replace(res.redirectTo ?? "/")
      router.refresh()
    })
  }

  const stepCopy = c.steps[current.id]
  const values = getValues()

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{c.title}</p>
          <CardTitle>
            <h1 ref={headingRef} tabIndex={-1} className="text-lg outline-none" data-testid="onboarding-step-title">
              {stepCopy.title}
            </h1>
          </CardTitle>
          <CardDescription>{stepCopy.description}</CardDescription>
        </div>
        <Progress value={((step + 1) / total) * 100} aria-valuetext={c.progress(step + 1, total)}>
          <ProgressLabel>{c.progress(step + 1, total)}</ProgressLabel>
        </Progress>
      </CardHeader>

      <form
        noValidate
        aria-label={c.title}
        onSubmit={(e) => {
          e.preventDefault()
          if (isLast) finish(false)
          else next()
        }}
      >
        <CardContent className="flex flex-col gap-6">
          {errors.root?.serverError && <FormAlert>{errors.root.serverError.message}</FormAlert>}

          {current.id === "profile" && (
            <FieldGroup>
              <Controller
                name="name"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="name">{c.nameLabel}</FieldLabel>
                    <Input
                      {...field}
                      id="name"
                      autoComplete="name"
                      readOnly={busy}
                      aria-invalid={fieldState.invalid || undefined}
                      aria-describedby={describedBy(fieldState.invalid && "name-error")}
                    />
                    {fieldState.invalid && <FieldError id="name-error">{fieldState.error?.message}</FieldError>}
                  </Field>
                )}
              />
            </FieldGroup>
          )}

          {current.id === "preferences" && (
            <FieldGroup>
              <Controller
                name="locale"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor="locale">{c.localeLabel}</FieldLabel>
                    <NativeSelect
                      {...field}
                      id="locale"
                      className="w-full"
                      disabled={busy}
                      aria-invalid={fieldState.invalid || undefined}
                      aria-describedby={describedBy("locale-description", fieldState.invalid && "locale-error")}
                    >
                      {LOCALES.map((l) => (
                        <NativeSelectOption key={l} value={l}>
                          {profileCopy.locales[l]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <FieldDescription id="locale-description">{c.localeHelp}</FieldDescription>
                    {fieldState.invalid && <FieldError id="locale-error">{fieldState.error?.message}</FieldError>}
                  </Field>
                )}
              />
            </FieldGroup>
          )}

          {current.id === "done" && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{c.summaryName}</dt>
              <dd>{values.name}</dd>
              <dt className="text-muted-foreground">{c.summaryLocale}</dt>
              <dd>{profileCopy.locales[values.locale]}</dd>
            </dl>
          )}
        </CardContent>

        <CardFooter className="mt-6 flex flex-wrap items-center gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => setStep((s) => s - 1)}>
              {c.back}
            </Button>
          )}
          <SubmitButton
            pending={isSaving}
            disabled={isSkipping}
            label={isLast ? c.finish : c.next}
            pendingLabel={isLast ? c.finishing : c.saving}
          />
          {!isLast && (
            <SubmitButton
              type="button"
              variant="ghost"
              className="ml-auto"
              pending={isSkipping}
              disabled={isSaving}
              label={c.skip}
              pendingLabel={c.skipping}
              onClick={() => finish(true)}
            />
          )}
        </CardFooter>
      </form>
    </Card>
  )
}
