/**
 * «Vía Fulvia»: the app does not hold Meta credentials; it asks the Fulvia
 * platform to send through Fulvia's WhatsApp number.
 *
 * PENDIENTE (14/11/2026): the platform endpoint DOES NOT EXIST YET. This is the
 * contract the platform has to implement, mirroring the landing module's
 * ingest (`ALLFLOW_INGEST_URL` + `ALLFLOW_INGEST_KEY`):
 *
 *   POST ${ALLFLOW_INGEST_URL}/whatsapp/messages
 *   Authorization: Bearer ${ALLFLOW_INGEST_KEY}
 *   { to: "+569…", type: "text", text: "…" }
 *   { to: "+569…", type: "template", template: { name, lang, params } }
 *   → 2xx { id: "<provider message id>" }
 *   → 4xx/5xx { error: { code: "131047" | "…" } }
 *
 * Until then every send answers `{ ok: false }` with the HTTP status (a 404),
 * so the row ends `failed`: it never pretends a message went out.
 */
import type {
  ProviderSendResult,
  TemplateMessage,
  WhatsAppProvider,
} from "../../contracts/types"
import { META_OUTSIDE_WINDOW } from "./meta"

export type FulviaOptions = {
  ingestUrl: string
  key: string
  fetch?: typeof fetch
}

export function fulviaProvider(opts: FulviaOptions): WhatsAppProvider {
  const doFetch = opts.fetch ?? fetch
  const url = `${opts.ingestUrl.replace(/\/+$/, "")}/whatsapp/messages`

  async function post(payload: Record<string, unknown>): Promise<ProviderSendResult> {
    let res: Response
    try {
      res = await doFetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${opts.key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
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
      const id = (body as { id?: unknown } | null)?.id
      return typeof id === "string" && id.length > 0
        ? { ok: true, providerMessageId: id }
        : { ok: false, errorCode: "bad_response" }
    }
    const code = (body as { error?: { code?: unknown } } | null)?.error?.code
    const errorCode =
      typeof code === "number" || typeof code === "string" ? String(code) : `http_${res.status}`
    return errorCode === META_OUTSIDE_WINDOW
      ? { ok: false, errorCode, outsideWindow: true }
      : { ok: false, errorCode }
  }

  return {
    name: "fulvia",
    sendText(to, text) {
      return post({ to, type: "text", text })
    },
    sendTemplate(to, t: TemplateMessage) {
      return post({
        to,
        type: "template",
        template: { name: t.name, lang: t.lang, params: t.params ?? [] },
      })
    },
  }
}
