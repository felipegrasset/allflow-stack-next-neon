/**
 * Functions other modules may import from `comments`. The component is in
 * `./comments` (`<Comments entity id href canAccess />`, see that file).
 *
 *   import { deleteCommentsFor, findMentions } from "@/modules/comments/contracts"
 *   await deleteCommentsFor("order", orderId)   // when the host deletes the record
 */
import { getKysely } from "@/server/db/pool"

import { deleteCommentsForWith } from "../server/store"

/** Removes every comment of a record (host cleanup; no permission check, host code). Returns how many. */
export const deleteCommentsFor = (entity: string, entityId: string): Promise<number> =>
  deleteCommentsForWith(getKysely(), entity, entityId)

export {
  COMMENT_MAX,
  canDeleteComment,
  findMentions,
  isEntityKey,
  isSafeHref,
  type Person,
  type Viewer,
} from "./domain"
export { commentSchemas, type AddCommentInput } from "./input"
