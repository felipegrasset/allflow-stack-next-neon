/**
 * The only thing another module may import from `notifications-email`:
 *
 *   import { notifyWithEmail } from "@/modules/notifications-email/contracts"
 *   await notifyWithEmail({ userId, title: "Tu informe está listo", href: "/reports/42", id: `report-${id}` })
 *   // → { id, created, email: "sent" | "disabled" | "no_provider" | … }
 *
 * `notifications/contracts` has no hook to attach a channel, so this module
 * wraps `notify()` instead: use `notifyWithEmail` where you want the email too,
 * `notify` where you do not. Server-only. The rest is pure.
 */
export { notifyWithEmail, type NotifyWithEmailResult } from "../server/api"
export type { EmailOutcome } from "../server/deliver"
export { buildMail, safeSubject, type MailCopy, type MailInput } from "./mail"
export { signUnsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from "./token"
