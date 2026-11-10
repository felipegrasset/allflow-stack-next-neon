"use server"

import { headers } from "next/headers"

import { submitLead, type LeadResult } from "./lead"

export type LeadState =
  | { status: "idle" }
  | { status: "ok" }
  | {
      status: "error"
      reason: Exclude<LeadResult, { ok: true }>["reason"]
      /** React 19 limpia el formulario tras la acción: se devuelve lo escrito para no perderlo. */
      values: { name?: string; email?: string; message?: string }
    }

const field = (fd: FormData, k: string) => {
  const v = fd.get(k)
  return typeof v === "string" && v !== "" ? v : undefined
}

/** Server Action del bloque `lead`. Vuelve a validar todo: es alcanzable por POST directo. */
export async function submitLeadAction(
  _prev: LeadState,
  fd: FormData
): Promise<LeadState> {
  const h = await headers()
  const result = await submitLead(
    {
      name: field(fd, "name"),
      email: field(fd, "email"),
      message: field(fd, "message"),
      consent: fd.get("consent") === "on" ? true : undefined,
      website: field(fd, "website"),
      captchaToken:
        field(fd, "cf-turnstile-response") ?? field(fd, "captchaToken"),
      utm_source: field(fd, "utm_source"),
      utm_medium: field(fd, "utm_medium"),
      utm_campaign: field(fd, "utm_campaign"),
      landing: field(fd, "landing"),
    },
    {
      fetch,
      env: {
        ALLFLOW_INGEST_URL: process.env.ALLFLOW_INGEST_URL,
        ALLFLOW_INGEST_KEY: process.env.ALLFLOW_INGEST_KEY,
        TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
      },
      now: () => new Date(),
      remoteIp: h.get("x-forwarded-for")?.split(",")[0]?.trim(),
    }
  )
  return result.ok
    ? { status: "ok" }
    : {
        status: "error",
        reason: result.reason,
        values: {
          name: field(fd, "name"),
          email: field(fd, "email"),
          message: field(fd, "message"),
        },
      }
}
