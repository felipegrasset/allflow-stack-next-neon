/**
 * The decision and the send, with every dependency injected (no `@/` imports,
 * no database): server/api.ts wires the real ones, the tests wire fakes.
 */
import { buildMail } from "../contracts/mail"
import { unsubscribeUrl } from "../contracts/token"
import { en, es } from "../messages"

export type EmailOutcome = "sent" | "disabled" | "no_provider" | "no_secret" | "no_user" | "failed"

export type Recipient = { email: string; locale: string; enabled: boolean }

export type DeliverDeps = {
  getRecipient: (userId: string) => Promise<Recipient | null>
  send: (mail: { to: string; subject: string; text: string; html: string }) => Promise<void>
  env: { resendApiKey?: string; secret?: string }
  baseUrl: string
  log?: (msg: string, err: unknown) => void
}

export type DeliverArgs = { userId: string; title: string; body?: string | null; href?: string | null }

/** Never throws: a failed email must not undo the in-app notification. */
export async function deliverEmail(deps: DeliverDeps, a: DeliverArgs): Promise<EmailOutcome> {
  try {
    if (!deps.env.resendApiKey) return "no_provider"
    if (!deps.env.secret) return "no_secret"
    const r = await deps.getRecipient(a.userId)
    if (!r || !r.email) return "no_user"
    if (!r.enabled) return "disabled"
    const copy = (r.locale === "en" ? en : es)["notifications-email"].email
    const mail = buildMail({
      to: r.email,
      title: a.title,
      body: a.body,
      href: a.href,
      baseUrl: deps.baseUrl,
      unsubscribeUrl: unsubscribeUrl(deps.baseUrl, a.userId, deps.env.secret),
      copy,
    })
    await deps.send(mail)
    return "sent"
  } catch (err) {
    deps.log?.("[notifications-email] send failed", err)
    return "failed"
  }
}
