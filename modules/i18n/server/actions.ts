"use server"

import { revalidatePath } from "next/cache"

import { isLocale } from "../contracts"
import { setLocaleCookie } from "./cookie"

/** The language selector's Server Action. Validates the value: a Server Action is reachable by direct POST. */
export async function setLocaleAction(
  locale: string
): Promise<{ ok: boolean }> {
  if (!isLocale(locale)) return { ok: false }
  await setLocaleCookie(locale)
  revalidatePath("/", "layout")
  return { ok: true }
}
