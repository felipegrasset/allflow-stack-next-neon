"use client"

import { useActionState, useState } from "react"

import { FormAlert } from "@/components/form-alert"
import { SubmitButton } from "@/components/submit-button"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { useModuleCopy } from "@/modules/i18n/contracts/client"

import { ARTICLE_LOCALES } from "../contracts/input"
import { es } from "../messages"
import { deleteArticleAction, saveArticleAction, setPublishedAction } from "../server/actions"
import type { ArticleFormState } from "../server/state"
import { FieldRow, TEXTAREA_CLASS } from "./field-row"

export type ArticleFormValues = {
  id: string
  slug: string
  title: string
  summary: string
  category: string
  locale: string
  sortOrder: number
  body: string
  published: boolean
}

const IDLE: ArticleFormState = { status: "idle" }

/** Create (no `article`) or edit an article. Server-validated; errors come back as field errors. */
export function ArticleForm({ article }: { article?: ArticleFormValues }) {
  const copy = useModuleCopy(es)
  const [state, formAction, pending] = useActionState<ArticleFormState, FormData>(saveArticleAction, IDLE)
  const prefix = article ? "hc-edit" : "hc-new"
  const err = (k: string) => (state.status === "error" ? state.fieldErrors?.[k] : undefined)
  const f = copy.admin.fields

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      aria-label={article ? copy.admin.editTitle : copy.admin.newTitle}
      aria-busy={pending}
    >
      {article ? <input type="hidden" name="id" value={article.id} /> : null}
      {state.status === "error" ? <FormAlert>{state.message}</FormAlert> : null}
      {state.status === "ok" ? <FormAlert variant="success">{state.message}</FormAlert> : null}
      <FieldGroup>
        <FieldRow id={`${prefix}-title`} label={f.title} error={err("title")}>
          {(aria) => <Input {...aria} name="title" defaultValue={article?.title ?? ""} maxLength={160} readOnly={pending} />}
        </FieldRow>
        <FieldRow id={`${prefix}-slug`} label={f.slug} description={f.slugHint} error={err("slug")}>
          {(aria) => (
            <Input {...aria} name="slug" defaultValue={article?.slug ?? ""} maxLength={80} autoComplete="off" readOnly={pending} />
          )}
        </FieldRow>
        <FieldRow id={`${prefix}-summary`} label={f.summary} description={f.summaryHint} error={err("summary")}>
          {(aria) => <Input {...aria} name="summary" defaultValue={article?.summary ?? ""} maxLength={300} readOnly={pending} />}
        </FieldRow>
        <FieldRow id={`${prefix}-category`} label={f.category} description={f.categoryHint} error={err("category")}>
          {(aria) => <Input {...aria} name="category" defaultValue={article?.category ?? ""} maxLength={60} readOnly={pending} />}
        </FieldRow>
        <FieldRow id={`${prefix}-locale`} label={f.locale} error={err("locale")}>
          {(aria) => (
            <NativeSelect {...aria} name="locale" defaultValue={article?.locale ?? "es"} disabled={pending}>
              {ARTICLE_LOCALES.map((l) => (
                <NativeSelectOption key={l} value={l}>
                  {copy.admin.locales[l]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FieldRow>
        <FieldRow id={`${prefix}-order`} label={f.sortOrder} description={f.sortOrderHint} error={err("sortOrder")}>
          {(aria) => (
            <Input {...aria} name="sortOrder" type="number" min={0} max={9999} step={1} defaultValue={article?.sortOrder ?? 0} readOnly={pending} />
          )}
        </FieldRow>
        <FieldRow id={`${prefix}-body`} label={f.body} description={f.bodyHint} error={err("body")}>
          {(aria) => (
            <textarea
              {...aria}
              name="body"
              rows={14}
              maxLength={20000}
              defaultValue={article?.body ?? ""}
              readOnly={pending}
              className={TEXTAREA_CLASS}
            />
          )}
        </FieldRow>
        <div className="flex items-start gap-2">
          <input
            id={`${prefix}-published`}
            type="checkbox"
            name="published"
            defaultChecked={article?.published ?? false}
            disabled={pending}
            aria-describedby={`${prefix}-published-hint`}
            className="mt-1 size-4 accent-primary"
          />
          <div className="flex flex-col gap-0.5">
            <label htmlFor={`${prefix}-published`} className="text-sm font-medium">
              {f.published}
            </label>
            <p id={`${prefix}-published-hint`} className="text-xs text-muted-foreground">
              {f.publishedHint}
            </p>
          </div>
        </div>
      </FieldGroup>
      <SubmitButton
        pending={pending}
        label={article ? copy.admin.save : copy.admin.create}
        pendingLabel={article ? copy.admin.saving : copy.admin.creating}
        className="self-start"
      />
    </form>
  )
}

/** Publish / unpublish and (two-step) delete of an existing article. */
export function ArticleActions({ id, published }: { id: string; published: boolean }) {
  const copy = useModuleCopy(es)
  const [pubState, pubAction, pubPending] = useActionState<ArticleFormState, FormData>(setPublishedAction, IDLE)
  const [delState, delAction, delPending] = useActionState<ArticleFormState, FormData>(deleteArticleAction, IDLE)
  const [confirming, setConfirming] = useState(false)
  const message = [pubState, delState].find((s) => s.status === "error")

  return (
    <div className="flex flex-col gap-3">
      {message && message.status === "error" ? <FormAlert>{message.message}</FormAlert> : null}
      {pubState.status === "ok" ? <FormAlert variant="success">{pubState.message}</FormAlert> : null}
      <div className="flex flex-wrap items-center gap-2">
        <form action={pubAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="publish" value={published ? "no" : "yes"} />
          <SubmitButton
            pending={pubPending}
            variant="outline"
            label={published ? copy.admin.unpublish : copy.admin.publish}
            pendingLabel={copy.admin.working}
          />
        </form>
        {confirming ? (
          <form action={delAction} className="flex flex-wrap items-center gap-2" role="group" aria-label={copy.admin.delete}>
            <input type="hidden" name="id" value={id} />
            <p className="text-sm text-destructive" role="alert">
              {copy.admin.deleteConfirm}
            </p>
            <SubmitButton pending={delPending} variant="destructive" label={copy.admin.deleteYes} pendingLabel={copy.admin.deleting} />
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={delPending}>
              {copy.admin.deleteCancel}
            </Button>
          </form>
        ) : (
          <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
            {copy.admin.delete}
          </Button>
        )}
      </div>
    </div>
  )
}
