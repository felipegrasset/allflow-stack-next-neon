import { getLocale } from "next-intl/server"

import { formatDateTime } from "@/modules/i18n/contracts"
import { getModuleCopy } from "@/modules/i18n/contracts/server"
import { getSession } from "@/server/session"
import { getKysely } from "@/server/db/pool"

import { GRANT_TTL_MS, issueGrant } from "../server/grant"
import { MENTION_CANDIDATES_MAX, isEntityId, isEntityKey, isSafeHref } from "../contracts/domain"
import { es } from "../messages"
import { can } from "../server/guard"
import { listComments, listPeople } from "../server/store"
import { CommentForm } from "./comment-form"
import { DeleteButton } from "./delete-button"
import { asLocale } from "./locale"

export type CanAccess = (ctx: { userId: string; entity: string; entityId: string }) => boolean | Promise<boolean>

export type CommentsProps = {
  /** Key of the commented record's kind, lowercase: "order", "task"… */
  entity: string
  /** Id of the record. */
  id: string
  /** Relative link of the page that shows this thread (where mentions take people). */
  href: string
  /**
   * REQUIRED. Can this person see the record? The module does not know the
   * app's entities, so the app decides. Called for the viewer and for each
   * person that could be mentioned. Without it, nothing is shown.
   */
  canAccess: CanAccess
}

/** Safe wrapper: a throwing check counts as "no". */
async function allowed(check: CanAccess, userId: string, entity: string, entityId: string): Promise<boolean> {
  try {
    return (await check({ userId, entity, entityId })) === true
  } catch {
    return false
  }
}

/**
 * Comment thread of any record. Server component. Renders NOTHING unless the
 * viewer has a session, the arguments are valid and `canAccess` says yes.
 */
export async function Comments({ entity, id, href, canAccess }: CommentsProps) {
  if (typeof canAccess !== "function" || !isEntityKey(entity) || !isEntityId(id) || !isSafeHref(href)) return null
  const session = await getSession()
  if (!session) return null
  const viewerId = session.user.id
  if (!(await allowed(canAccess, viewerId, entity, id))) return null

  const db = getKysely()
  const [copy, locale, canCreate, canModerate, comments, candidates] = await Promise.all([
    getModuleCopy(es),
    getLocale().then(asLocale),
    can("create"),
    can("delete"),
    listComments(db, entity, id),
    listPeople(db, 100),
  ])

  // Only people who can see the record may be mentioned (and are told).
  let mentionable: { id: string; name: string }[] = []
  if (canCreate) {
    const pool = candidates.filter((p) => p.id !== viewerId)
    const checks = await Promise.all(pool.map((p) => allowed(canAccess, p.id, entity, id)))
    mentionable = pool.filter((_, i) => checks[i]).slice(0, MENTION_CANDIDATES_MAX)
  }
  const grant = issueGrant(
    { u: viewerId, e: entity, i: id, h: href, m: mentionable.map((p) => p.id) },
    GRANT_TTL_MS,
    process.env.BETTER_AUTH_SECRET
  )
  const headingId = `comments-${entity}-${id}`.replace(/[^a-zA-Z0-9_-]/g, "_")

  return (
    <section className="flex flex-col gap-4" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-base font-medium">
          {copy.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.count(comments.length)}</p>
      </div>
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {comments.map((c) => {
            const name = c.authorName ?? copy.unknownUser
            const mayDelete = grant !== null && (canModerate || c.authorId === viewerId)
            return (
              <li key={c.id} className="flex flex-col gap-1 rounded-lg border border-border p-3">
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{name}</span>
                  <time dateTime={c.createdAt.toISOString()}>{formatDateTime(c.createdAt, locale)}</time>
                </p>
                <p className="text-sm whitespace-pre-line break-words">{c.body}</p>
                {mayDelete && grant ? <DeleteButton grant={grant} commentId={c.id} authorName={name} /> : null}
              </li>
            )
          })}
        </ol>
      )}
      {canCreate && grant ? (
        <CommentForm grant={grant} people={mentionable.map((p) => p.name)} formId={headingId} />
      ) : null}
    </section>
  )
}
