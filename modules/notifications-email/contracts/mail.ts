/** Pure: builds the email body. No imports from the app. */

export type MailCopy = { open: string; footer: string; unsubscribe: string }

export type MailInput = {
  to: string
  title: string
  body?: string | null
  /** Internal path ("/tickets/1") or null. */
  href?: string | null
  baseUrl: string
  unsubscribeUrl: string
  copy: MailCopy
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** Subject without line breaks (header injection) and at most 150 chars. */
export function safeSubject(title: string): string {
  return title.replace(/[\r\n]+/g, " ").trim().slice(0, 150)
}

export function buildMail(i: MailInput): { to: string; subject: string; text: string; html: string } {
  const link = i.href ? new URL(i.href, i.baseUrl).toString() : null
  const lines = [i.title, ...(i.body ? ["", i.body] : []), ...(link ? ["", `${i.copy.open}: ${link}`] : [])]
  const text = `${lines.join("\n")}\n\n--\n${i.copy.footer}\n${i.copy.unsubscribe}: ${i.unsubscribeUrl}`
  const html =
    `<p><strong>${esc(i.title)}</strong></p>` +
    (i.body ? `<p>${esc(i.body)}</p>` : "") +
    (link ? `<p><a href="${esc(link)}">${esc(i.copy.open)}</a></p>` : "") +
    `<hr><p style="font-size:12px">${esc(i.copy.footer)} ` +
    `<a href="${esc(i.unsubscribeUrl)}">${esc(i.copy.unsubscribe)}</a></p>`
  return { to: i.to, subject: safeSubject(i.title), text, html }
}
