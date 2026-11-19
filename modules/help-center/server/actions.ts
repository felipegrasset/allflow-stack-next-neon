"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { z } from "zod"

import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { articleSchemas } from "../contracts/input"
import { es } from "../messages"
import { actionSession } from "./guard"
import { createArticle, deleteArticle, isUniqueViolation, setPublished, updateArticle } from "./mutations"
import type { ArticleFormState } from "./state"

/**
 * Every action is reachable by direct POST, so each one: (1) checks session
 * and `article:write` with `actionSession` BEFORE touching data, (2) validates
 * the input with Zod, (3) only then writes.
 */

function fieldErrors(error: z.ZodError): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === "string" && !(key in out)) out[key] = issue.message
  }
  return out
}

const str = (v: FormDataEntryValue | null): string => (typeof v === "string" ? v : "")

function revalidate(slugs: string[] = []) {
  revalidatePath("/admin/help")
  revalidatePath("/ayuda")
  for (const s of slugs) revalidatePath(`/ayuda/${s}`)
}

export async function saveArticleAction(_prev: ArticleFormState, formData: FormData): Promise<ArticleFormState> {
  const session = await actionSession("/admin/help", "write")
  const copy = await getModuleCopy(es)
  if (!session) return { status: "error", message: copy.errors.forbidden }
  const { articleSchema, idSchema } = articleSchemas(copy.validation)
  const rawId = str(formData.get("id"))
  const id = rawId === "" ? null : idSchema.safeParse({ id: rawId }).data?.id
  if (id === undefined) return { status: "error", message: copy.errors.notFound }

  const parsed = articleSchema.safeParse({
    title: str(formData.get("title")),
    slug: str(formData.get("slug")),
    summary: str(formData.get("summary")),
    category: str(formData.get("category")),
    locale: str(formData.get("locale")),
    sortOrder: Number(str(formData.get("sortOrder")) || "0"),
    body: str(formData.get("body")),
    published: formData.get("published") === "on",
  })
  if (!parsed.success)
    return { status: "error", message: copy.errors.invalid, fieldErrors: fieldErrors(parsed.error) }

  let newId: string | null = null
  try {
    if (id) {
      const found = await updateArticle(id, parsed.data)
      if (!found) return { status: "error", message: copy.errors.notFound }
    } else {
      newId = await createArticle(parsed.data, session.user.id)
    }
  } catch (err) {
    if (isUniqueViolation(err))
      return { status: "error", message: copy.errors.invalid, fieldErrors: { slug: copy.errors.slugTaken } }
    return { status: "error", message: copy.errors.generic }
  }
  revalidate([parsed.data.slug])
  if (newId) redirect(`/admin/help?id=${encodeURIComponent(newId)}`)
  return { status: "ok", message: copy.admin.saved }
}

export async function setPublishedAction(_prev: ArticleFormState, formData: FormData): Promise<ArticleFormState> {
  const session = await actionSession("/admin/help", "write")
  const copy = await getModuleCopy(es)
  if (!session) return { status: "error", message: copy.errors.forbidden }
  const parsed = articleSchemas(copy.validation).idSchema.safeParse({ id: str(formData.get("id")) })
  if (!parsed.success) return { status: "error", message: copy.errors.notFound }
  const publish = formData.get("publish") === "yes"
  try {
    const found = await setPublished(parsed.data.id, publish)
    if (!found) return { status: "error", message: copy.errors.notFound }
  } catch {
    return { status: "error", message: copy.errors.generic }
  }
  revalidate()
  revalidatePath("/ayuda", "layout")
  return { status: "ok", message: publish ? copy.admin.published : copy.admin.unpublished }
}

export async function deleteArticleAction(_prev: ArticleFormState, formData: FormData): Promise<ArticleFormState> {
  const session = await actionSession("/admin/help", "write")
  const copy = await getModuleCopy(es)
  if (!session) return { status: "error", message: copy.errors.forbidden }
  const parsed = articleSchemas(copy.validation).idSchema.safeParse({ id: str(formData.get("id")) })
  if (!parsed.success) return { status: "error", message: copy.errors.notFound }
  try {
    const found = await deleteArticle(parsed.data.id)
    if (!found) return { status: "error", message: copy.errors.notFound }
  } catch {
    return { status: "error", message: copy.errors.generic }
  }
  revalidate()
  revalidatePath("/ayuda", "layout")
  redirect("/admin/help")
}
