import { notFound } from "next/navigation"

import { ButtonLink } from "@/components/button-link"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getSession } from "@/server/session"

import { slugSchema, resolveText } from "../contracts/definition"
import { es } from "../messages"
import { getFormBySlug } from "../server/store"
import { FillForm } from "./fill-form"
import { activeLocale } from "./locale"

/**
 * /f/[slug] — public. Anyone may answer an OPEN form; a draft or an unknown
 * slug is a 404, a closed form says it no longer takes responses. When the
 * form asks for one response per person the visitor must sign in first.
 */
export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!slugSchema.safeParse(slug).success) notFound()
  const form = await getFormBySlug(slug)
  if (!form || form.status === "draft") notFound()
  const [copy, locale, session] = await Promise.all([getModuleCopy(es), activeLocale(), getSession()])
  const def = form.definition

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{resolveText(def.title, locale)}</h1>
        {def.description ? <p className="text-sm text-muted-foreground">{resolveText(def.description, locale)}</p> : null}
      </div>
      {form.status === "closed" ? (
        <div className="flex flex-col gap-1">
          <p className="font-medium">{copy.public.closedTitle}</p>
          <p className="text-sm text-muted-foreground">{copy.public.closedHint}</p>
        </div>
      ) : form.onePerPerson && !session ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm">{copy.public.loginRequired}</p>
          <ButtonLink href={`/login?next=${encodeURIComponent(`/f/${form.slug}`)}`}>{copy.public.signIn}</ButtonLink>
        </div>
      ) : (
        <FillForm slug={form.slug} definition={def} locale={locale} />
      )}
    </main>
  )
}
