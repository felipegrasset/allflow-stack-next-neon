import type { ModulePermissions } from "../contract/types"

/**
 * `message:send` — send WhatsApp messages from the app's screens
 * (/admin/whatsapp, or any module that checks `canSendWhatsApp()`).
 * Every message has a cost and goes to a person's phone, so: owner and admin
 * get it (default), member does not. It is also `adminAccess`: it opens the
 * /admin area and the /admin/whatsapp screen (server/authz.ts), so a custom role
 * with `message:send` can operate WhatsApp without being admin. Server code (a cron, a hook) that calls
 * `sendWhatsApp` directly is not checked here; it answers for itself.
 */
export const permissions = {
  statement: { message: ["send"] },
  adminAccess: { message: ["send"] },
} as const satisfies ModulePermissions
