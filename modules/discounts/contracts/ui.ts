/**
 * Client-safe UI of `discounts` for orders' pages or the app:
 *
 *   import { DiscountCodeForm } from "@/modules/discounts/contracts/ui"
 *   <DiscountCodeForm orderId={order.id} appliedCode={order.discountCode} />
 *
 * It sends only the order id and the typed code; the server checks the
 * session, that the order is the person's and pending, and computes the
 * amount from the stored order. Show it only while the order is `pending`
 * and before "Pay".
 */
export { DiscountCodeForm } from "../ui/discount-code-form"
