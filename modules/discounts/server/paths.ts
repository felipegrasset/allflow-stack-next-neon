/** Routes of the discounts module (manifest.json `routes`). */
export const ADMIN_PATH = "/admin/discounts"
export const discountPagePath = (orderId: string) => `/orders/${orderId}/descuento`
export const orderPagePath = (orderId: string) => `/orders/${orderId}`
