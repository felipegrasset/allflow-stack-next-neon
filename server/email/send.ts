import { appendFile } from "node:fs/promises"
import { Resend } from "resend"

import { APP_TITLE } from "@/lib/site"

/**
 * The one way the app sends email.
 *
 * - RESEND_API_KEY set → Resend, from EMAIL_FROM (default: Resend's shared
 *   test sender, which only delivers to the account owner — set EMAIL_FROM
 *   with a verified domain before going live).
 * - Otherwise → the dev sender: prints the message (and its links) to the
 *   server console. With DEV_MAIL_OUTBOX=<path> it also appends one JSON line
 *   per message to that file — the e2e tests read verification links from it.
 */

export type Email = { to: string; subject: string; text: string; html?: string }

let resend: Resend | undefined

export async function sendEmail(email: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (key) {
    resend ??= new Resend(key)
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? `${APP_TITLE} <onboarding@resend.dev>`,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    })
    if (error) throw new Error(`Resend: ${error.name}: ${error.message}`)
    return
  }

  console.log(`\n[dev-email] → ${email.to}\n[dev-email] ${email.subject}\n${email.text}\n`)
  const outbox = process.env.DEV_MAIL_OUTBOX
  if (outbox) {
    await appendFile(outbox, JSON.stringify({ ...email, at: new Date().toISOString() }) + "\n")
  }
}

/**
 * Whether sign-up has to wait for the email to be verified.
 *
 * Yes when there is a way to deliver the email (Resend), and yes off Vercel
 * (local dev and CI read the link from the console / the dev outbox). The one
 * case where it is off: a deployed app without an email provider — there the
 * link only reaches the server logs, and requiring it would leave every new
 * user stuck on "check your email". Connecting Resend turns it back on.
 */
export function emailVerificationRequired(): boolean {
  if (process.env.RESEND_API_KEY) return true
  return !process.env.VERCEL
}
