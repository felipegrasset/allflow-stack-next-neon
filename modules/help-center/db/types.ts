import type { ColumnType } from "kysely"

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>
type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>

export interface HelpCenterArticlesTable {
  id: string
  slug: string
  title: string
  summary: string | null
  /** Plain text or minimal markdown (contracts/markdown.ts). Never HTML. */
  body: string
  category: string | null
  locale: string
  sort_order: ColumnType<number, number | undefined, number>
  published: ColumnType<boolean, boolean | undefined, boolean>
  published_at: NullableTimestamp
  /** User id, no foreign key on purpose: articles outlive their author. */
  author_id: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface HelpCenterFeedbackTable {
  id: string
  article_id: string
  /** sha-256 of the visitor cookie token. Never the token, never a user id. */
  voter_hash: string
  helpful: boolean
  comment: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

declare module "@/server/db/schema" {
  interface Database {
    help_center_articles: HelpCenterArticlesTable
    help_center_feedback: HelpCenterFeedbackTable
  }
}
