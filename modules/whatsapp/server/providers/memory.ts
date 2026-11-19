import type {
  ProviderSendResult,
  TemplateMessage,
  WhatsAppProvider,
} from "../../contracts/types"

export type MemorySent =
  | { to: string; type: "text"; text: string; id: string }
  | { to: string; type: "template"; template: TemplateMessage; id: string }

/**
 * Sends nothing: keeps what it was asked to send. For tests, and for local
 * development with WHATSAPP_PROVIDER=memory (refused in production). `fail`
 * makes the next sends answer an error code, to test failure paths.
 */
export function memoryProvider(
  opts: { fail?: () => ProviderSendResult | null } = {}
): WhatsAppProvider & { readonly sent: MemorySent[] } {
  const sent: MemorySent[] = []
  // Random ids: a dev server restarts, and the (provider, id) pair is unique in the table.
  const next = (): ProviderSendResult => {
    const forced = opts.fail?.()
    if (forced) return forced
    return { ok: true, providerMessageId: `wamid.memory.${crypto.randomUUID()}` }
  }
  return {
    name: "memory",
    sent,
    async sendText(to, text) {
      const r = next()
      if (r.ok) sent.push({ to, type: "text", text, id: r.providerMessageId })
      return r
    },
    async sendTemplate(to, template) {
      const r = next()
      if (r.ok) sent.push({ to, type: "template", template, id: r.providerMessageId })
      return r
    },
  }
}
