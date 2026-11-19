/**
 * The component of `comments` (server component). Import it from here, not
 * from `index.ts` (which is for functions):
 *
 *   import { Comments } from "@/modules/comments/contracts/comments"
 *
 *   <Comments
 *     entity="order" id={order.id} href={`/orders/${order.id}`}
 *     canAccess={async ({ userId, entityId }) => userCanSeeOrder(userId, entityId)}
 *   />
 *
 * `canAccess` is REQUIRED and is the host's job: the module does not know your
 * entities, so YOU say who can see the record. It is called for the viewer and
 * for every person who could be mentioned (people who cannot see the record are
 * neither listed nor notified). No session, invalid arguments or `canAccess`
 * answering anything but `true` (or throwing) → renders nothing.
 */
export { Comments, type CanAccess, type CommentsProps } from "../ui/comments"
