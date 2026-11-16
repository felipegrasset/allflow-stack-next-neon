/**
 * Client-safe UI of `orders` for other modules and app pages, e.g. the
 * product page of a store:
 *
 *   import { AddToCart } from "@/modules/orders/contracts/ui"
 *   <AddToCart itemId={item.id} />
 *
 * It sends only the item id and a quantity; the server re-checks that the item
 * is sellable, and prices are computed at checkout.
 */
export { AddToCart } from "../ui/add-to-cart"
