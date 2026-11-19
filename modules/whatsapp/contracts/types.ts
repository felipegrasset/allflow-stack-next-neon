/**
 * Pure types and constants of the whatsapp module (no server imports), so a
 * client component or a test can import them too.
 */

/** Consent of one phone number. `none`: never recorded (no consent). */
export type ConsentStatus = "opted_in" | "opted_out" | "none"

/** Where a consent change came from (stored in `whatsapp_optins.source`). */
export const CONSENT_SOURCES = [
  /** A form of the app, with a consent checkbox the person ticked. */
  "form",
  /** The person wrote an opt-in / opt-out keyword to the number (ALTA, BAJA…). */
  "keyword",
  /** Someone of the team, from /admin/whatsapp (opt-out only). */
  "admin",
  /** Server code of the app (an import, an API), with its own evidence. */
  "api",
] as const
export type ConsentSource = (typeof CONSENT_SOURCES)[number]

export type Consent = {
  phone: string
  status: ConsentStatus
  userId: string | null
  source: ConsentSource | null
  optedInAt: Date | null
  optedOutAt: Date | null
}

export type MessageDirection = "outbound" | "inbound"
export type MessageKind = "text" | "template" | "other"

/**
 * Outbound: pending → sent → delivered → read, or failed / blocked.
 * Inbound: received.
 */
export const MESSAGE_STATUSES = [
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
  "blocked",
  "received",
] as const
export type MessageStatus = (typeof MESSAGE_STATUSES)[number]

export type WhatsAppMessage = {
  id: string
  direction: MessageDirection
  phone: string
  kind: MessageKind
  templateName: string | null
  templateLang: string | null
  /** Text of a free-form message (both directions); null for templates and media. */
  body: string | null
  status: MessageStatus
  provider: string | null
  providerMessageId: string | null
  /** Why it is `blocked` or `failed` (a SendBlockReason, or the provider's error code). */
  errorCode: string | null
  userId: string | null
  sentBy: string | null
  createdAt: Date
}

/** A template approved in WhatsApp Manager, sent by name and language. */
export type TemplateMessage = {
  /** The template name exactly as approved in Meta (`appointment_reminder`). */
  name: string
  /** Its language code as approved (`es`, `es_CL`, `en_US`). */
  lang: string
  /** Values of {{1}}, {{2}}, … of the body, in order. */
  params?: string[]
}

export type SendInput = {
  /** Recipient, E.164 (`+56912345678`); spaces, dashes and `whatsapp:` are tolerated. */
  to: string
  /** Free text: only inside the 24 h window opened by the person's last message. */
  text?: string
  /** An approved template: the only thing allowed outside the 24 h window. */
  template?: TemplateMessage
  /** The app user this number belongs to, if any (stored on the row). */
  userId?: string
  /** Who triggered the send (a user id); gets a notification if it fails. */
  sentBy?: string
  /**
   * Idempotency key: the same key twice sends once (a cron that retries, a
   * double click). Up to 200 characters.
   */
  idempotencyKey?: string
}

/** Why a message was NOT sent, before reaching the provider. */
export const SEND_BLOCK_REASONS = [
  "invalid_input",
  "invalid_phone",
  /** No opt-in recorded for this number. */
  "no_optin",
  /** The person opted out: the opt-out always wins. */
  "opted_out",
  /** Free text outside the 24 h window: only templates may be sent. */
  "outside_window",
  /** WHATSAPP_PROVIDER missing or incomplete. */
  "not_configured",
] as const
export type SendBlockReason = (typeof SEND_BLOCK_REASONS)[number]

export type SendResult =
  | { ok: true; messageId: string; providerMessageId: string; deduped: boolean }
  | { ok: false; reason: SendBlockReason; messageId?: string }
  /** The provider refused or could not be reached; the row is `failed`. */
  | { ok: false; reason: "provider_error"; messageId: string; errorCode: string; deduped?: boolean }

// ── provider ────────────────────────────────────────────────────────────────

export type ProviderSendResult =
  | { ok: true; providerMessageId: string }
  | {
      ok: false
      /** Provider error code as a string (`131047`, `http_500`, `network`). Never a message body. */
      errorCode: string
      /** The provider says the 24 h window is closed (Meta 131047). */
      outsideWindow?: boolean
    }

/**
 * What puts a message on the wire. Two real implementations over `fetch`
 * (Meta Cloud API, «vía Fulvia») and one in memory for tests and development.
 * A provider never decides consent or the window: send.ts does, before.
 */
export interface WhatsAppProvider {
  readonly name: "meta" | "fulvia" | "memory"
  sendText(to: string, text: string): Promise<ProviderSendResult>
  sendTemplate(to: string, template: TemplateMessage): Promise<ProviderSendResult>
}

export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000
export const MAX_TEXT_LENGTH = 4096
