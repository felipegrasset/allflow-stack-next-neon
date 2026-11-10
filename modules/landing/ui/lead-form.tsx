"use client"

import { useActionState, useCallback, useState } from "react"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { describedBy } from "@/lib/forms"

import {
  ATTR_COOKIE,
  UTM_KEYS,
  decodeUtm,
  readCookie,
  utmFromSearch,
  type Utm,
} from "../attribution"
import { submitLeadAction, type LeadState } from "../server/actions"
import type { CopyOf } from "../schema"
import { Turnstile } from "./turnstile"

type Props = {
  id: string
  variant: "card" | "inline"
  copy: CopyOf<"lead">
  /** Clave pública de Turnstile; sin ella no se monta el widget. */
  turnstileSiteKey?: string
}

const INITIAL: LeadState = { status: "idle" }

export function LeadForm({ id, variant, copy, turnstileSiteKey }: Props) {
  const [state, action, pending] = useActionState(submitLeadAction, INITIAL)
  const [token, setToken] = useState("")
  const onToken = useCallback((t: string) => setToken(t), [])
  const inline = variant === "inline"

  // La atribución se lee al enviar y se vuelca en los campos ocultos: sin
  // estado ni efecto (la URL o la cookie pueden haber cambiado desde el montaje,
  // y la cookie de primer toque es la que importa).
  function fillAttribution(form: HTMLFormElement) {
    try {
      const fromUrl = utmFromSearch(window.location.search)
      const utm: Utm = Object.keys(fromUrl).length
        ? fromUrl
        : decodeUtm(readCookie(document.cookie, ATTR_COOKIE))
      const set = (name: string, value: string) => {
        const el = form.elements.namedItem(name)
        if (el instanceof HTMLInputElement) el.value = value
      }
      for (const k of UTM_KEYS) set(k, utm[k] ?? "")
      set("landing", window.location.pathname)
    } catch {
      // sin atribución: el lead se envía igual
    }
  }

  if (state.status === "ok")
    return (
      <FormAlert variant="success" title={copy.doneTitle}>
        {copy.doneBody}
      </FormAlert>
    )

  const errorText =
    state.status === "error"
      ? state.reason === "consent"
        ? copy.errorConsent
        : state.reason === "captcha"
          ? copy.errorCaptcha
          : copy.errorGeneric
      : null
  const kept = state.status === "error" ? state.values : {}
  const consentId = `${id}-consent`
  const errId = `${id}-error`

  return (
    <form
      action={action}
      onSubmit={(e) => fillAttribution(e.currentTarget)}
      className="flex flex-col gap-4"
    >
      {errorText && <FormAlert>{errorText}</FormAlert>}
      {/* Honeypot: fuera de la vista y del orden de tabulación. */}
      <div
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {UTM_KEYS.map((k) => (
        <input key={k} type="hidden" name={k} />
      ))}
      <input type="hidden" name="landing" />
      <input type="hidden" name="captchaToken" value={token} />

      <div
        className={
          inline ? "flex flex-col gap-3 sm:flex-row" : "flex flex-col gap-4"
        }
      >
        {!inline && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-name`}>{copy.labels.name}</Label>
            <Input
              id={`${id}-name`}
              name="name"
              autoComplete="name"
              readOnly={pending}
              defaultValue={kept.name}
            />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1.5">
          <Label
            htmlFor={`${id}-email`}
            className={inline ? "sr-only" : undefined}
          >
            {copy.labels.email}
          </Label>
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={inline ? copy.labels.email : undefined}
            readOnly={pending}
            defaultValue={kept.email}
            aria-invalid={state.status === "error" || undefined}
            aria-describedby={describedBy(errorText ? errId : undefined)}
          />
        </div>
        {!inline && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-message`}>{copy.labels.message}</Label>
            <textarea
              id={`${id}-message`}
              name="message"
              rows={4}
              readOnly={pending}
              defaultValue={kept.message}
              className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            />
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 text-sm">
        <input
          id={consentId}
          name="consent"
          type="checkbox"
          required
          disabled={pending}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <Label htmlFor={consentId} className="font-normal">
          {copy.labels.consent}
          {copy.privacy && (
            <>
              {" "}
              <a
                href={copy.privacy.href}
                className="underline underline-offset-4"
              >
                {copy.privacy.label}
              </a>
            </>
          )}
        </Label>
      </div>

      {turnstileSiteKey && (
        <Turnstile siteKey={turnstileSiteKey} onToken={onToken} />
      )}

      <SubmitButton
        pending={pending}
        label={copy.labels.submit}
        pendingLabel={copy.labels.sending}
        className={inline ? "sm:w-fit" : "w-fit"}
      />
    </form>
  )
}
