"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireOnboardedUser } from "@/server/session"

import type { SendBlockReason } from "../contracts/types"
import { canSendWhatsApp, requireWhatsAppAccess } from "./authz"
import { recordOptOut } from "./consent"
import { sendDeps, store } from "./runtime"
import { sendWhatsApp } from "./send"

export type ActionErrorCode = SendBlockReason | "provider_error" | "forbidden" | "unknown"

export type SendActionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; code: ActionErrorCode; providerCode?: string }

export type OptOutActionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; code: "invalid_phone" | "invalid_input" | "unknown" }

const sendFormSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("text"),
    to: z.string().trim().min(1).max(40),
    text: z.string().trim().min(1).max(4096),
  }),
  z.object({
    mode: z.literal("template"),
    to: z.string().trim().min(1).max(40),
    templateName: z.string().trim().min(1).max(512),
    templateLang: z.string().trim().min(2).max(10),
    templateParams: z.string().max(10000).optional(),
  }),
])

const field = (fd: FormData, k: string) => {
  const v = fd.get(k)
  return typeof v === "string" ? v : undefined
}

/** Reachable by direct POST: session, `message:send`, zod; sendWhatsApp applies consent and window. */
export async function sendAction(
  _prev: SendActionState,
  formData: FormData
): Promise<SendActionState> {
  const session = await requireOnboardedUser("/admin/whatsapp")
  if (!(await canSendWhatsApp())) return { status: "error", code: "forbidden" }
  const parsed = sendFormSchema.safeParse({
    mode: field(formData, "mode"),
    to: field(formData, "to"),
    text: field(formData, "text"),
    templateName: field(formData, "templateName"),
    templateLang: field(formData, "templateLang"),
    templateParams: field(formData, "templateParams"),
  })
  if (!parsed.success) return { status: "error", code: "invalid_input" }
  const v = parsed.data
  try {
    const r = await sendWhatsApp(sendDeps(), {
      to: v.to,
      sentBy: session.user.id,
      ...(v.mode === "text"
        ? { text: v.text }
        : {
            template: {
              name: v.templateName,
              lang: v.templateLang,
              params: (v.templateParams ?? "")
                .split("\n")
                .map((p) => p.trim())
                .filter(Boolean),
            },
          }),
    })
    revalidatePath("/admin/whatsapp")
    if (r.ok) return { status: "ok" }
    if (r.reason === "provider_error")
      return { status: "error", code: "provider_error", providerCode: r.errorCode }
    return { status: "error", code: r.reason }
  } catch (err) {
    console.error("whatsapp: sendAction failed", err instanceof Error ? err.name : "unknown")
    return { status: "error", code: "unknown" }
  }
}

/** Needs `message:send` (the screen's permission). The opt-out always applies. */
export async function optOutAction(
  _prev: OptOutActionState,
  formData: FormData
): Promise<OptOutActionState> {
  await requireWhatsAppAccess("/admin/whatsapp")
  try {
    const r = await recordOptOut(store(), {
      phone: field(formData, "phone") ?? "",
      source: "admin",
    })
    if (!r.ok)
      return { status: "error", code: r.reason === "invalid_phone" ? "invalid_phone" : "invalid_input" }
    revalidatePath("/admin/whatsapp")
    return { status: "ok" }
  } catch (err) {
    console.error("whatsapp: optOutAction failed", err instanceof Error ? err.name : "unknown")
    return { status: "error", code: "unknown" }
  }
}
