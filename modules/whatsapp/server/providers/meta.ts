/**
 * Meta WhatsApp Cloud API over plain `fetch` (no SDK).
 *
 *   POST https://graph.facebook.com/<version>/<phone-number-id>/messages
 *   Authorization: Bearer <token>
 *   { messaging_product: "whatsapp", to: "<digits>", type: "text" | "template", … }
 *
 * Success answers `{ messages: [{ id: "wamid.…" }] }`; an error answers
 * `{ error: { code, error_subcode, message } }`. Only the numeric code is kept:
 * Meta's message can echo the recipient or the text, so it is never stored
 * nor logged. Error 131047 means the 24 h window is closed.
 */
import type {
  ProviderSendResult,
  TemplateMessage,
  WhatsAppProvider,
} from "../../contracts/types"
import { toWaId } from "../phone"

export const META_GRAPH_URL = "https://graph.facebook.com"
export const META_DEFAULT_API_VERSION = "v23.0"
/** "Re-engagement message": more than 24 h since the person's last message. */
export const META_OUTSIDE_WINDOW = "131047"

export type MetaOptions = {
  token: string
  phoneNumberId: string
  apiVersion?: string
  graphUrl?: string
  fetch?: typeof fetch
}

export function metaProvider(opts: MetaOptions): WhatsAppProvider {
  const doFetch = opts.fetch ?? fetch
  const base = (opts.graphUrl ?? META_GRAPH_URL).replace(/\/+$/, "")
  const version = opts.apiVersion || META_DEFAULT_API_VERSION
  const url = `${base}/${encodeURIComponent(version)}/${encodeURIComponent(opts.phoneNumberId)}/messages`

  async function post(payload: Record<string, unknown>): Promise<ProviderSendResult> {
    let res: Response
    try {
      res = await doFetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${opts.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
      })
    } catch {
      return { ok: false, errorCode: "network" }
    }
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    if (res.ok) {
      const id = (body as { messages?: { id?: unknown }[] } | null)?.messages?.[0]?.id
      if (typeof id === "string" && id.length > 0) return { ok: true, providerMessageId: id }
      return { ok: false, errorCode: "bad_response" }
    }
    const code = (body as { error?: { code?: unknown } } | null)?.error?.code
    const errorCode =
      typeof code === "number" || typeof code === "string" ? String(code) : `http_${res.status}`
    return errorCode === META_OUTSIDE_WINDOW
      ? { ok: false, errorCode, outsideWindow: true }
      : { ok: false, errorCode }
  }

  return {
    name: "meta",
    sendText(to, text) {
      return post({ to: toWaId(to), type: "text", text: { preview_url: false, body: text } })
    },
    sendTemplate(to, t: TemplateMessage) {
      const params = t.params ?? []
      return post({
        to: toWaId(to),
        type: "template",
        template: {
          name: t.name,
          language: { code: t.lang },
          ...(params.length > 0
            ? {
                components: [
                  { type: "body", parameters: params.map((p) => ({ type: "text", text: p })) },
                ],
              }
            : {}),
        },
      })
    },
  }
}
