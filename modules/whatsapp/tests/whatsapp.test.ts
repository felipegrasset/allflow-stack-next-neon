/**
 * whatsapp — todo lo que se puede probar SIN base de datos ni red: números,
 * ventana de 24 h, palabras clave, reglas de consentimiento, el envío (con un
 * almacén en memoria y el proveedor en memoria), los dos proveedores reales
 * contra un `fetch` falso, la configuración, la firma y el webhook completo.
 * La implementación Kysely (server/store.ts) necesita Postgres: sin probar acá.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import type {
  Consent,
  MessageStatus,
  ProviderSendResult,
  WhatsAppMessage,
} from "../contracts/types"
import { readConfig, providerFromEnv } from "../server/config"
import { recordOptIn, recordOptOut } from "../server/consent"
import { parseWebhookPayload } from "../server/inbound"
import { detectKeyword } from "../server/keywords"
import { maskPhone, normalizePhone } from "../server/phone"
import { fulviaProvider } from "../server/providers/fulvia"
import { memoryProvider } from "../server/providers/memory"
import { metaProvider } from "../server/providers/meta"
import { sendWhatsApp, type SendDeps } from "../server/send"
import { signBody, verifySignature } from "../server/signature"
import { RECEIPT_FROM, type NewMessage, type WhatsAppStore } from "../server/store"
import { handleVerify, handleWebhook } from "../server/webhook"
import { permissions } from "../permissions"
import { withinServiceWindow } from "../server/window"

const PHONE = "+12025550143"
const NOW = new Date("2026-11-14T12:00:00Z")
const HOUR = 60 * 60 * 1000

// ── almacén en memoria con la misma semántica que kyselyStore ───────────────

type Row = WhatsAppMessage & { idempotencyKey: string | null }

function memoryStore() {
  const consents = new Map<string, Consent>()
  const rows: Row[] = []
  const store: WhatsAppStore = {
    async getConsent(phone) {
      return (
        consents.get(phone) ?? {
          phone,
          status: "none",
          userId: null,
          source: null,
          optedInAt: null,
          optedOutAt: null,
        }
      )
    },
    async writeConsent(w) {
      const prev = consents.get(w.phone)
      consents.set(w.phone, {
        phone: w.phone,
        status: w.status,
        source: w.source,
        userId: w.userId ?? prev?.userId ?? null,
        optedInAt: w.status === "opted_in" ? w.at : prev?.optedInAt ?? null,
        optedOutAt: w.status === "opted_out" ? w.at : prev?.optedOutAt ?? null,
      })
    },
    async lastInboundAt(phone) {
      const ts = rows
        .filter((r) => r.phone === phone && r.direction === "inbound")
        .map((r) => r.createdAt.getTime())
      return ts.length ? new Date(Math.max(...ts)) : null
    },
    async findByIdempotencyKey(key) {
      return rows.find((r) => r.idempotencyKey === key) ?? null
    },
    async insertMessage(m: NewMessage) {
      if (m.idempotencyKey && rows.some((r) => r.idempotencyKey === m.idempotencyKey)) return false
      if (
        m.providerMessageId &&
        rows.some((r) => r.provider === m.provider && r.providerMessageId === m.providerMessageId)
      )
        return false
      rows.push({ ...m, createdAt: m.createdAt ?? NOW })
      return true
    },
    async updateMessage(id, patch) {
      const r = rows.find((x) => x.id === id)!
      r.status = patch.status
      if (patch.providerMessageId !== undefined) r.providerMessageId = patch.providerMessageId
      if (patch.errorCode !== undefined) r.errorCode = patch.errorCode
    },
    async applyReceipt(provider, pid, status, errorCode) {
      const r = rows.find(
        (x) => x.provider === provider && x.providerMessageId === pid && x.direction === "outbound"
      )
      if (!r || !(RECEIPT_FROM[status] as MessageStatus[]).includes(r.status)) return null
      r.status = status
      if (status === "failed") r.errorCode = errorCode ?? "failed"
      return { ...r }
    },
    async listMessages({ phone, limit }) {
      return rows.filter((r) => !phone || r.phone === phone).slice(-limit).reverse()
    },
    async listConsents({ limit }) {
      return [...consents.values()].slice(0, limit)
    },
    async forget(phone) {
      const before = rows.length
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].phone === phone) rows.splice(i, 1)
      consents.delete(phone)
      return before - rows.length
    },
  }
  return { store, rows, consents }
}

let seq = 0
const newId = () => `id-${++seq}`

function setup(opts: { fail?: () => ProviderSendResult | null; configured?: boolean } = {}) {
  const mem = memoryStore()
  const provider = memoryProvider({ fail: opts.fail })
  const logs: string[] = []
  const deps: SendDeps = {
    store: mem.store,
    provider: () => (opts.configured === false ? null : provider),
    now: () => NOW,
    newId,
    log: (msg, meta) => logs.push(`${msg} ${JSON.stringify(meta ?? {})}`),
  }
  return { ...mem, provider, deps, logs }
}

async function inbound(store: WhatsAppStore, phone: string, at: Date, id = `wamid.in.${++seq}`) {
  await store.insertMessage({
    id: newId(),
    direction: "inbound",
    phone,
    kind: "text",
    templateName: null,
    templateLang: null,
    body: "hola",
    status: "received",
    provider: "memory",
    providerMessageId: id,
    errorCode: null,
    idempotencyKey: null,
    userId: null,
    sentBy: null,
    createdAt: at,
  })
}

// ── números, ventana, palabras clave ─────────────────────────────────────────

test("normalizePhone deja un E.164 único y rechaza lo que no lo es", () => {
  assert.equal(normalizePhone("+1 (202) 555-0143"), PHONE)
  assert.equal(normalizePhone("12025550143"), PHONE)
  assert.equal(normalizePhone("whatsapp:+12025550143"), PHONE)
  assert.equal(normalizePhone(PHONE), PHONE)
  assert.equal(normalizePhone("+0123456789"), null)
  assert.equal(normalizePhone("1234"), null)
  assert.equal(normalizePhone("+1202555014312345"), null)
  assert.equal(normalizePhone("abc"), null)
})

test("maskPhone no deja el número completo", () => {
  const m = maskPhone(PHONE)
  assert.ok(!m.includes("2025550143"))
  assert.ok(m.endsWith("0143"))
})

test("ventana de 24 h: rodante, sin futuro y sin mensaje previo no hay ventana", () => {
  assert.equal(withinServiceWindow(null, NOW), false)
  assert.equal(withinServiceWindow(new Date(NOW.getTime() - 23.9 * HOUR), NOW), true)
  assert.equal(withinServiceWindow(new Date(NOW.getTime() - 24 * HOUR), NOW), false)
  assert.equal(withinServiceWindow(new Date(NOW.getTime() + HOUR), NOW), false)
  assert.equal(withinServiceWindow(new Date("x"), NOW), false)
})

test("palabras clave: mensaje completo, sin tildes ni mayúsculas", () => {
  assert.equal(detectKeyword("baja"), "opt_out")
  assert.equal(detectKeyword("  Stop! "), "opt_out")
  assert.equal(detectKeyword("No más mensajes"), "opt_out")
  assert.equal(detectKeyword("ALTA"), "opt_in")
  assert.equal(detectKeyword("start"), "opt_in")
  assert.equal(detectKeyword("quiero darme de baja de las promos"), null)
  assert.equal(detectKeyword("hola"), null)
  assert.equal(detectKeyword(null), null)
})

// ── consentimiento ──────────────────────────────────────────────────────────

test("opt-in registra; la baja gana y un formulario no la revierte", async () => {
  const { store } = memoryStore()
  assert.deepEqual(await recordOptIn(store, { phone: "+1 202 555 0143", source: "form" }, NOW), {
    ok: true,
    phone: PHONE,
    status: "opted_in",
  })
  assert.equal((await recordOptOut(store, { phone: PHONE, source: "admin" }, NOW)).ok, true)
  assert.equal((await store.getConsent(PHONE)).status, "opted_out")
  assert.deepEqual(await recordOptIn(store, { phone: PHONE, source: "api" }, NOW), {
    ok: false,
    reason: "opted_out",
  })
  assert.equal((await store.getConsent(PHONE)).status, "opted_out")
})

test("opt-in rechaza número inválido y un origen que no es form/api", async () => {
  const { store } = memoryStore()
  assert.deepEqual(await recordOptIn(store, { phone: "123", source: "form" }), {
    ok: false,
    reason: "invalid_phone",
  })
  assert.deepEqual(
    await recordOptIn(store, { phone: PHONE, source: "keyword" as unknown as "form" }),
    { ok: false, reason: "invalid_input" }
  )
})

// ── envío ───────────────────────────────────────────────────────────────────

test("sin proveedor configurado no sale nada", async () => {
  const t = setup({ configured: false })
  await recordOptIn(t.store, { phone: PHONE, source: "form" })
  const r = await sendWhatsApp(t.deps, { to: PHONE, template: { name: "aviso", lang: "es" } })
  assert.deepEqual(r, { ok: false, reason: "not_configured" })
  assert.equal(t.rows.length, 0)
})

test("sin opt-in: bloqueado, sin llamar al proveedor y sin guardar el texto", async () => {
  const t = setup()
  await inbound(t.store, PHONE, new Date(NOW.getTime() - HOUR))
  const r = await sendWhatsApp(t.deps, { to: PHONE, text: "secreto 123" })
  assert.equal(r.ok, false)
  assert.equal(!r.ok && r.reason, "no_optin")
  assert.equal(t.provider.sent.length, 0)
  const blocked = t.rows.find((x) => x.status === "blocked")!
  assert.equal(blocked.body, null)
  assert.equal(blocked.errorCode, "no_optin")
  assert.ok(t.logs.every((l) => !l.includes("secreto") && !l.includes("2025550143")))
})

test("dado de baja: bloqueado aunque la ventana esté abierta", async () => {
  const t = setup()
  await recordOptIn(t.store, { phone: PHONE, source: "form" })
  await recordOptOut(t.store, { phone: PHONE, source: "api" })
  await inbound(t.store, PHONE, new Date(NOW.getTime() - HOUR))
  const r = await sendWhatsApp(t.deps, { to: PHONE, text: "hola" })
  assert.equal(!r.ok && r.reason, "opted_out")
  const r2 = await sendWhatsApp(t.deps, { to: PHONE, template: { name: "aviso", lang: "es" } })
  assert.equal(!r2.ok && r2.reason, "opted_out")
  assert.equal(t.provider.sent.length, 0)
})

test("texto libre: solo dentro de 24 h del último mensaje entrante", async () => {
  const t = setup()
  await recordOptIn(t.store, { phone: PHONE, source: "form" })
  const outside = await sendWhatsApp(t.deps, { to: PHONE, text: "hola" })
  assert.equal(!outside.ok && outside.reason, "outside_window")
  await inbound(t.store, PHONE, new Date(NOW.getTime() - 25 * HOUR))
  const stillOutside = await sendWhatsApp(t.deps, { to: PHONE, text: "hola" })
  assert.equal(!stillOutside.ok && stillOutside.reason, "outside_window")
  await inbound(t.store, PHONE, new Date(NOW.getTime() - 2 * HOUR))
  const inside = await sendWhatsApp(t.deps, { to: PHONE, text: "hola" })
  assert.equal(inside.ok, true)
  assert.equal(t.provider.sent.length, 1)
  const row = t.rows.find((x) => inside.ok && x.id === inside.messageId)!
  assert.equal(row.status, "sent")
  assert.equal(row.body, "hola")
})

test("plantilla: sale fuera de la ventana con opt-in", async () => {
  const t = setup()
  await recordOptIn(t.store, { phone: PHONE, source: "form" })
  const r = await sendWhatsApp(t.deps, {
    to: PHONE,
    template: { name: "recordatorio_cita", lang: "es_CL", params: ["Ana", "martes"] },
  })
  assert.equal(r.ok, true)
  assert.deepEqual(t.provider.sent[0].type, "template")
})

test("idempotencia: la misma llave envía una sola vez", async () => {
  const t = setup()
  await recordOptIn(t.store, { phone: PHONE, source: "form" })
  const input = {
    to: PHONE,
    template: { name: "aviso", lang: "es" },
    idempotencyKey: "cita-1-24h",
  }
  const a = await sendWhatsApp(t.deps, input)
  const b = await sendWhatsApp(t.deps, input)
  assert.equal(a.ok && a.deduped, false)
  assert.equal(b.ok && b.deduped, true)
  assert.equal(a.ok && b.ok && a.messageId === b.messageId, true)
  assert.equal(t.provider.sent.length, 1)
})

test("una llave usada en un envío bloqueado no queda gastada", async () => {
  const t = setup()
  const input = { to: PHONE, template: { name: "aviso", lang: "es" }, idempotencyKey: "k-1" }
  const blocked = await sendWhatsApp(t.deps, input)
  assert.equal(!blocked.ok && blocked.reason, "no_optin")
  await recordOptIn(t.store, { phone: PHONE, source: "form" })
  const sent = await sendWhatsApp(t.deps, input)
  assert.equal(sent.ok, true)
})

test("error del proveedor: fila failed con el código; 131047 se informa como fuera de ventana", async () => {
  let next: ProviderSendResult | null = { ok: false, errorCode: "131026" }
  const t = setup({ fail: () => next })
  await recordOptIn(t.store, { phone: PHONE, source: "form" })
  const r = await sendWhatsApp(t.deps, { to: PHONE, template: { name: "aviso", lang: "es" } })
  assert.equal(!r.ok && r.reason, "provider_error")
  assert.equal(t.rows.at(-1)!.status, "failed")
  assert.equal(t.rows.at(-1)!.errorCode, "131026")
  next = { ok: false, errorCode: "131047", outsideWindow: true }
  const r2 = await sendWhatsApp(t.deps, { to: PHONE, template: { name: "aviso", lang: "es" } })
  assert.equal(!r2.ok && r2.reason, "outside_window")
})

test("entrada inválida: texto y plantilla a la vez, o ninguno, o plantilla mal nombrada", async () => {
  const t = setup()
  for (const input of [
    { to: PHONE },
    { to: PHONE, text: "a", template: { name: "x", lang: "es" } },
    { to: PHONE, template: { name: "Con Espacios", lang: "es" } },
    { to: PHONE, template: { name: "ok", lang: "español" } },
  ]) {
    const r = await sendWhatsApp(t.deps, input)
    assert.equal(!r.ok && r.reason, "invalid_input")
  }
  const r = await sendWhatsApp(t.deps, { to: "123", text: "a" })
  assert.equal(!r.ok && r.reason, "invalid_phone")
})

// ── proveedores contra fetch falso ──────────────────────────────────────────

type Call = { url: string; init: RequestInit }
function fakeFetch(respond: (c: Call) => Response) {
  const calls: Call[] = []
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    const c = { url: String(url), init: init ?? {} }
    calls.push(c)
    return respond(c)
  }) as typeof fetch
  return { f, calls }
}

test("Meta: URL, Bearer, destinatario sin + y forma de la plantilla", async () => {
  const { f, calls } = fakeFetch(() => Response.json({ messages: [{ id: "wamid.ABC" }] }))
  const p = metaProvider({ token: "tok", phoneNumberId: "555", fetch: f })
  const r = await p.sendTemplate(PHONE, { name: "aviso", lang: "es", params: ["Ana"] })
  assert.deepEqual(r, { ok: true, providerMessageId: "wamid.ABC" })
  assert.equal(calls[0].url, "https://graph.facebook.com/v23.0/555/messages")
  const h = calls[0].init.headers as Record<string, string>
  assert.equal(h.authorization, "Bearer tok")
  const body = JSON.parse(String(calls[0].init.body))
  assert.equal(body.messaging_product, "whatsapp")
  assert.equal(body.to, "12025550143")
  assert.deepEqual(body.template, {
    name: "aviso",
    language: { code: "es" },
    components: [{ type: "body", parameters: [{ type: "text", text: "Ana" }] }],
  })
  await p.sendText(PHONE, "hola")
  const text = JSON.parse(String(calls[1].init.body))
  assert.deepEqual(text.text, { preview_url: false, body: "hola" })
})

test("Meta: código de error, 131047 y red caída", async () => {
  const err = fakeFetch(() =>
    Response.json({ error: { code: 131047, message: "Re-engagement" } }, { status: 400 })
  )
  const r = await metaProvider({ token: "t", phoneNumberId: "1", fetch: err.f }).sendText(PHONE, "x")
  assert.deepEqual(r, { ok: false, errorCode: "131047", outsideWindow: true })
  const html = fakeFetch(() => new Response("<html>", { status: 502 }))
  const r2 = await metaProvider({ token: "t", phoneNumberId: "1", fetch: html.f }).sendText(PHONE, "x")
  assert.deepEqual(r2, { ok: false, errorCode: "http_502" })
  const down = (async () => {
    throw new TypeError("fetch failed")
  }) as typeof fetch
  const r3 = await metaProvider({ token: "t", phoneNumberId: "1", fetch: down }).sendText(PHONE, "x")
  assert.deepEqual(r3, { ok: false, errorCode: "network" })
})

test("Fulvia: POST a la ingesta con la llave; un 404 (endpoint pendiente) es un fallo, no un éxito", async () => {
  const { f, calls } = fakeFetch(() => new Response("not found", { status: 404 }))
  const p = fulviaProvider({ ingestUrl: "https://crm.test/api/ingest/v1/", key: "afk_x", fetch: f })
  const r = await p.sendTemplate(PHONE, { name: "aviso", lang: "es" })
  assert.deepEqual(r, { ok: false, errorCode: "http_404" })
  assert.equal(calls[0].url, "https://crm.test/api/ingest/v1/whatsapp/messages")
  assert.equal((calls[0].init.headers as Record<string, string>).authorization, "Bearer afk_x")
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    to: PHONE,
    type: "template",
    template: { name: "aviso", lang: "es", params: [] },
  })
})

// ── configuración ───────────────────────────────────────────────────────────

test("configuración: nada por defecto, memory nunca en producción, faltantes por nombre", () => {
  assert.equal(readConfig({}).provider, null)
  assert.equal(providerFromEnv({}), null)
  assert.equal(readConfig({ WHATSAPP_PROVIDER: "memory", NODE_ENV: "production" }).provider, null)
  assert.equal(providerFromEnv({ WHATSAPP_PROVIDER: "memory", NODE_ENV: "development" })?.name, "memory")
  const meta = readConfig({ WHATSAPP_PROVIDER: "meta", WHATSAPP_META_TOKEN: "t" })
  assert.equal(meta.provider, "meta")
  assert.deepEqual(meta.missing, [
    "WHATSAPP_META_PHONE_NUMBER_ID",
    "WHATSAPP_META_APP_SECRET",
    "WHATSAPP_META_VERIFY_TOKEN",
  ])
  assert.equal(providerFromEnv({ WHATSAPP_PROVIDER: "meta", WHATSAPP_META_TOKEN: "t" }), null)
  assert.equal(
    providerFromEnv({ WHATSAPP_PROVIDER: "fulvia", ALLFLOW_INGEST_URL: "https://x.test", ALLFLOW_INGEST_KEY: "k" })?.name,
    "fulvia"
  )
})

// ── firma y webhook ─────────────────────────────────────────────────────────

test("firma: correcta, alterada, ausente o sin secreto", () => {
  const body = '{"a":1}'
  assert.equal(verifySignature(body, signBody(body, "s3cret"), "s3cret"), true)
  assert.equal(verifySignature(body + " ", signBody(body, "s3cret"), "s3cret"), false)
  assert.equal(verifySignature(body, signBody(body, "otro"), "s3cret"), false)
  assert.equal(verifySignature(body, null, "s3cret"), false)
  assert.equal(verifySignature(body, signBody(body, "s3cret"), null), false)
  assert.equal(verifySignature(body, "sha256=zz", "s3cret"), false)
})

const SECRET = "app-secret"
const metaEnv = {
  WHATSAPP_PROVIDER: "meta",
  WHATSAPP_META_TOKEN: "t",
  WHATSAPP_META_PHONE_NUMBER_ID: "PNID",
  WHATSAPP_META_APP_SECRET: SECRET,
  WHATSAPP_META_VERIFY_TOKEN: "verify-me",
}

function payload(value: Record<string, unknown>, pnid = "PNID") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA",
        changes: [
          {
            field: "messages",
            value: { messaging_product: "whatsapp", metadata: { phone_number_id: pnid }, ...value },
          },
        ],
      },
    ],
  }
}

const textMsg = (id: string, body: string, ts = Math.floor(NOW.getTime() / 1000) - 60) => ({
  messages: [{ from: "12025550143", id, timestamp: String(ts), type: "text", text: { body } }],
})

function post(body: unknown, secret: string | null = SECRET) {
  const raw = JSON.stringify(body)
  return new Request("https://app.test/api/whatsapp/webhook", {
    method: "POST",
    headers: secret ? { "x-hub-signature-256": signBody(raw, secret) } : {},
    body: raw,
  })
}

function webhookSetup(env: Record<string, string> = metaEnv) {
  const mem = memoryStore()
  const failed: string[] = []
  const logs: string[] = []
  const deps = {
    config: () => readConfig(env),
    store: () => mem.store,
    onFailed: async (m: { messageId: string }) => {
      failed.push(m.messageId)
    },
    now: () => NOW,
    newId,
    log: (msg: string, meta?: Record<string, unknown>) => logs.push(`${msg} ${JSON.stringify(meta ?? {})}`),
  }
  return { ...mem, deps, failed, logs }
}

test("webhook sin configurar o con firma mala: 401 y nada escrito", async () => {
  const none = webhookSetup({})
  assert.equal((await handleWebhook(post(payload(textMsg("w1", "hola"))), none.deps)).status, 401)
  const t = webhookSetup()
  assert.equal((await handleWebhook(post(payload(textMsg("w1", "hola")), "malo"), t.deps)).status, 401)
  assert.equal((await handleWebhook(post(payload(textMsg("w1", "hola")), null), t.deps)).status, 401)
  assert.equal(t.rows.length, 0)
})

test("webhook: guarda el mensaje una vez aunque Meta lo reenvíe, y abre la ventana", async () => {
  const t = webhookSetup()
  const body = payload(textMsg("wamid.IN1", "hola, consulta"))
  assert.equal((await handleWebhook(post(body), t.deps)).status, 200)
  assert.equal((await handleWebhook(post(body), t.deps)).status, 200)
  assert.equal(t.rows.length, 1)
  assert.equal(t.rows[0].phone, PHONE)
  assert.equal(t.rows[0].body, "hola, consulta")
  assert.equal(t.rows[0].provider, "meta")
  assert.equal(withinServiceWindow(await t.store.lastInboundAt(PHONE), NOW), true)
  // Un mensaje entrante NO es consentimiento.
  assert.equal((await t.store.getConsent(PHONE)).status, "none")
  assert.ok(t.logs.every((l) => !l.includes("consulta") && !l.includes("2025550143")))
})

test("webhook: BAJA da de baja y bloquea los envíos; ALTA de la persona la revierte", async () => {
  const t = webhookSetup()
  await recordOptIn(t.store, { phone: PHONE, source: "form" })
  await handleWebhook(post(payload(textMsg("wamid.B", "Baja"))), t.deps)
  assert.equal((await t.store.getConsent(PHONE)).status, "opted_out")
  const provider = memoryProvider()
  const r = await sendWhatsApp(
    { store: t.store, provider: () => provider, now: () => NOW, newId },
    { to: PHONE, text: "¿seguro?" }
  )
  assert.equal(!r.ok && r.reason, "opted_out")
  assert.equal(provider.sent.length, 0)
  await handleWebhook(post(payload(textMsg("wamid.A", "ALTA"))), t.deps)
  const c = await t.store.getConsent(PHONE)
  assert.equal(c.status, "opted_in")
  assert.equal(c.source, "keyword")
})

test("webhook: eventos de otro número de Meta se ignoran", async () => {
  const t = webhookSetup()
  await handleWebhook(post(payload(textMsg("wamid.X", "BAJA"), "OTRO")), t.deps)
  assert.equal(t.rows.length, 0)
  assert.equal((await t.store.getConsent(PHONE)).status, "none")
})

test("webhook: recibos solo avanzan; un failed avisa una sola vez", async () => {
  const t = webhookSetup()
  await t.store.insertMessage({
    id: "out-1",
    direction: "outbound",
    phone: PHONE,
    kind: "template",
    templateName: "aviso",
    templateLang: "es",
    body: null,
    status: "sent",
    provider: "meta",
    providerMessageId: "wamid.OUT1",
    errorCode: null,
    idempotencyKey: null,
    userId: null,
    sentBy: "user-1",
  })
  const st = (status: string, extra: Record<string, unknown> = {}) =>
    payload({ statuses: [{ id: "wamid.OUT1", status, recipient_id: "12025550143", ...extra }] })
  await handleWebhook(post(st("read")), t.deps)
  await handleWebhook(post(st("delivered")), t.deps) // llega tarde: no retrocede
  assert.equal(t.rows[0].status, "read")

  await t.store.updateMessage("out-1", { status: "sent" })
  const failed = st("failed", { errors: [{ code: 131026, title: "Undeliverable" }] })
  await handleWebhook(post(failed), t.deps)
  await handleWebhook(post(failed), t.deps)
  assert.equal(t.rows[0].status, "failed")
  assert.equal(t.rows[0].errorCode, "131026")
  assert.deepEqual(t.failed, ["out-1"])
})

test("webhook: JSON inválido firmado → 400; cuerpo enorme → 413", async () => {
  const t = webhookSetup()
  const raw = "{no json"
  const bad = new Request("https://app.test/api/whatsapp/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": signBody(raw, SECRET) },
    body: raw,
  })
  assert.equal((await handleWebhook(bad, t.deps)).status, 400)
  const big = new Request("https://app.test/api/whatsapp/webhook", {
    method: "POST",
    headers: { "content-length": String(10 * 1024 * 1024) },
    body: "x",
  })
  assert.equal((await handleWebhook(big, t.deps)).status, 413)
})

test("webhook: un error de la base responde 500 (Meta reintenta)", async () => {
  const t = webhookSetup()
  t.deps.store = () => ({
    ...t.store,
    insertMessage: async () => {
      throw new Error("db down")
    },
  })
  assert.equal((await handleWebhook(post(payload(textMsg("w9", "hola"))), t.deps)).status, 500)
})

test("parseWebhookPayload: tolera formas desconocidas y no fecha en el futuro", () => {
  assert.deepEqual(parseWebhookPayload(null), [])
  assert.deepEqual(parseWebhookPayload({ entry: [{ changes: [{ field: "account_update" }] }] }), [])
  const future = Math.floor(NOW.getTime() / 1000) + 3600
  const [e] = parseWebhookPayload(payload(textMsg("w", "hola", future)), NOW)
  assert.equal(e.type === "message" && e.at.getTime(), NOW.getTime())
  const [img] = parseWebhookPayload(
    payload({ messages: [{ from: "12025550143", id: "w2", timestamp: "1", type: "image", image: {} }] }),
    NOW
  )
  assert.equal(img.type === "message" && img.text, null)
})

test("GET de verificación: eco del challenge solo con el token correcto", async () => {
  const deps = { config: () => readConfig(metaEnv) }
  const ok = handleVerify(
    new Request("https://app.test/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345"),
    deps
  )
  assert.equal(ok.status, 200)
  assert.equal(await ok.text(), "12345")
  const bad = handleVerify(
    new Request("https://app.test/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=12345"),
    deps
  )
  assert.equal(bad.status, 403)
  const xss = handleVerify(
    new Request("https://app.test/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=%3Cscript%3E"),
    deps
  )
  assert.equal(xss.status, 403)
})

// ── permisos y accesos (lectura del código; corre desde la raíz del repo) ─────

const read = (rel: string) => readFileSync(join(process.cwd(), "modules/whatsapp", rel), "utf8")

test("permisos: message:send abre /admin y es lo que pide la pantalla, no «ser admin»", () => {
  assert.deepEqual(permissions.statement, { message: ["send"] })
  assert.deepEqual(permissions.adminAccess, { message: ["send"] })
  assert.match(read("nav.ts"), /area: "admin", permission: \{ message: \["send"\] \}/)
  for (const f of ["ui/page.tsx", "server/actions.ts"]) {
    assert.doesNotMatch(read(f), /requireAdmin/, f)
    assert.match(read(f), /requireWhatsAppAccess\("\/admin\/whatsapp"\)/, f)
  }
  assert.match(read("server/authz.ts"), /if \(!\(await canSendWhatsApp\(\)\)\) forbidden\(\)/)
})

test("la acción de enviar sigue exigiendo message:send antes de enviar", () => {
  const src = read("server/actions.ts")
  const send = src.slice(src.indexOf("export async function sendAction"), src.indexOf("export async function optOutAction"))
  assert.ok(send.indexOf("canSendWhatsApp()") > -1 && send.indexOf("canSendWhatsApp()") < send.indexOf("sendWhatsApp("))
})
