import Link from "next/link"

import { ButtonLink } from "@/components/button-link"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"

import { es } from "../messages"
import { can, requirePagePermission } from "../server/guard"
import { getForAdmin, listFeedbackComments, listForAdmin } from "../server/queries"
import { ArticleActions, ArticleForm } from "./article-form"
import { activeLocale } from "./locale"

type SearchParams = Promise<{ id?: string | string[]; new?: string | string[] }>

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""

/**
 * /admin/help — the editor. `article:read` sees the list and the ratings;
 * `article:write` also gets the form (`?id=<id>` to edit, `?new=1` to create).
 */
export default async function HelpAdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePagePermission("/admin/help", "read")
  const sp = await searchParams
  const id = one(sp.id).slice(0, 100)
  const creating = one(sp.new) === "1"
  const [copy, locale, canWrite] = await Promise.all([getModuleCopy(es), activeLocale(), can("write")])
  const [rows, selected] = await Promise.all([listForAdmin(), id ? getForAdmin(id) : Promise.resolve(null)])
  const comments = selected ? await listFeedbackComments(selected.id) : []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{copy.admin.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.admin.subtitle}</p>
        </div>
        {canWrite ? (
          <ButtonLink href="/admin/help?new=1" size="sm">
            {copy.admin.newLink}
          </ButtonLink>
        ) : null}
      </div>
      {canWrite ? null : <p className="text-sm text-muted-foreground">{copy.admin.readOnly}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <section className="flex flex-col gap-3" aria-labelledby="hc-list">
          <h2 id="hc-list" className="text-base font-medium">
            {copy.admin.listTitle}
          </h2>
          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {copy.admin.empty}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {rows.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/admin/help?id=${encodeURIComponent(a.id)}`}
                    aria-current={a.id === selected?.id ? "true" : undefined}
                    className="flex flex-col gap-1 px-4 py-3 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=true]:bg-muted"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{a.title}</span>
                      <Badge variant={a.published ? "secondary" : "outline"}>
                        {a.published ? copy.admin.published : copy.admin.unpublished}
                      </Badge>
                      <Badge variant="outline">{copy.admin.locales[a.locale]}</Badge>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.category ? `${a.category} · ` : ""}
                      {a.helpfulYes + a.helpfulNo === 0
                        ? copy.admin.noRatings
                        : copy.admin.stats(a.helpfulYes, a.helpfulNo)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-4" aria-label={selected ? copy.admin.editTitle : copy.admin.newTitle}>
          {selected ? (
            <>
              <h2 className="text-base font-medium">{copy.admin.editTitle}</h2>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link href={`/ayuda/${encodeURIComponent(selected.slug)}`} className="text-primary underline-offset-4 hover:underline">
                  {selected.published ? copy.admin.viewPublic : copy.admin.preview}
                </Link>
              </div>
              {canWrite ? (
                <>
                  <ArticleForm
                    key={selected.id}
                    article={{
                      id: selected.id,
                      slug: selected.slug,
                      title: selected.title,
                      summary: selected.summary ?? "",
                      category: selected.category ?? "",
                      locale: selected.locale,
                      sortOrder: selected.sortOrder,
                      body: selected.body,
                      published: selected.published,
                    }}
                  />
                  <ArticleActions id={selected.id} published={selected.published} />
                </>
              ) : null}
              <section className="flex flex-col gap-2" aria-labelledby="hc-comments">
                <h3 id="hc-comments" className="text-sm font-medium">
                  {copy.admin.commentsTitle}
                </h3>
                {comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{copy.admin.commentsEmpty}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {comments.map((c) => (
                      <li key={c.id} className="flex flex-col gap-1 rounded-lg border border-border p-3">
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant={c.helpful ? "secondary" : "outline"}>
                            {c.helpful ? copy.admin.helpfulTag : copy.admin.notHelpfulTag}
                          </Badge>
                          <time dateTime={c.createdAt.toISOString()}>{formatDateTime(c.createdAt, locale)}</time>
                        </p>
                        <p className="text-sm whitespace-pre-line">{c.comment}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : canWrite && (creating || rows.length === 0) ? (
            <>
              <h2 className="text-base font-medium">{copy.admin.newTitle}</h2>
              <ArticleForm />
            </>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
