# whatsapp — mensajes de WhatsApp con consentimiento (v0.1)

> Contrato en texto plano. Un agente que instala o usa este módulo lee SOLO este
> archivo y `manifest.json`.

## Qué hace

Envía mensajes de WhatsApp desde la app (texto libre o plantillas aprobadas en
Meta), lleva el registro de consentimientos (opt-in y baja) y recibe por webhook
los mensajes entrantes y los recibos de entrega. Cada mensaje **cuesta dinero** y
llega al teléfono de una persona: por eso las reglas de abajo se aplican siempre,
dentro del módulo, y no dependen de quien lo llame.

## Reglas (no negociables)

1. **Sin opt-in vigente no sale nada.** Sin fila en `whatsapp_optins` = sin consentimiento.
   Un mensaje entrante **no** es consentimiento.
2. **La baja gana siempre.** `recordOptOut` se aplica desde cualquier origen. Una
   vez dado de baja, **solo la persona** vuelve, escribiendo `ALTA`/`START` desde
   ese número: `recordOptIn` desde un formulario, un import o el equipo devuelve
   `{ ok: false, reason: "opted_out" }` y no cambia nada.
3. **Ventana de 24 h.** Texto libre solo si el último mensaje **entrante** de ese
   número fue hace menos de 24 h (rodante). Fuera de ella, solo plantillas. Si Meta
   igual responde 131047, el envío queda `failed` con motivo `outside_window`.
4. **Webhook con firma.** HMAC-SHA256 del cuerpo crudo (`X-Hub-Signature-256`).
   Sin secreto configurado o con firma mala: 401 y nada escrito. Idempotente:
   un evento reenviado por Meta no se guarda dos veces ni aplica dos veces.
5. **Nada de cuerpos en los logs.** Ni texto, ni número completo, ni el mensaje de
   error de Meta (solo su código numérico). Los avisos usan el número enmascarado.
6. **Nada por defecto.** Sin `WHATSAPP_PROVIDER` los envíos responden
   `not_configured`. `memory` (no envía nada) se rechaza en producción.

Palabras clave (mensaje completo, sin importar mayúsculas ni tildes):
baja → `BAJA`, `DARME DE BAJA`, `STOP`, `UNSUBSCRIBE`, `DESUSCRIBIR`,
`CANCELAR SUSCRIPCION`, `NO MAS MENSAJES`; alta → `ALTA`, `START`, `SUSCRIBIR`,
`SUBSCRIBE`. «Quiero darme de baja de las promos» no cuenta (la app puede leerlo
con `listMessages` y llamar `recordOptOut`). El módulo **no** responde
confirmando la baja (sería otro mensaje con costo a quien pidió no recibir más).

## Qué expone

- **Rutas:**
  - `GET|POST /api/whatsapp/webhook` (pública; GET = handshake de Meta con
    `WHATSAPP_META_VERIFY_TOKEN`, POST autenticado por firma).
  - `/admin/whatsapp` (sesión + onboarding + `message:send`; no pide ser admin): estado del proveedor y variables
    faltantes, formulario de envío (con `message:send`), consentimientos con
    botón «Dar de baja», y los últimos 50 mensajes (sin mostrar el texto).
- **Tablas** (migración `0113_whatsapp_init`):
  - `whatsapp_optins`: `phone` (E.164, PK), `status` (`opted_in`|`opted_out`),
    `user_id`, `source` (`form`|`keyword`|`admin`|`api`), `evidence`,
    `opted_in_at`, `opted_out_at`.
  - `whatsapp_messages`: `direction`, `phone`, `kind` (`text`|`template`|`other`),
    `template_name`/`template_lang`, `body` (texto libre; null en plantillas,
    multimedia y bloqueados), `status` (`pending`→`sent`→`delivered`→`read`,
    `failed`, `blocked`, `received`), `provider` + `provider_message_id` (únicos
    juntos), `idempotency_key` (único), `error_code`, `user_id`, `sent_by`.
- **Permisos:** recurso `message`, acción `send`. owner y admin la tienen; member no. Es además
  `adminAccess` (abre la puerta de `/admin`) y la que pide la pantalla completa, también «Dar de baja»
  (`requireWhatsAppAccess` en `server/authz.ts`): quien puede enviar ve los números y mensajes de la
  pantalla. Enviar sigue comprobando `message:send` en la acción.
- **Navegación:** «WhatsApp» → `/admin/whatsapp` (`area: "admin"`, visible con `message:send`).
- **Textos:** `messages.ts`, espacio `whatsapp` en `es` y `en`.
- **Entidades que cubre:** mensaje de whatsapp / whatsapp message,
  consentimiento de whatsapp / whatsapp consent, opt-in de whatsapp / whatsapp opt-in.
- **Depende de:** `notifications` (solo `notify` de su `contracts/`): avisa a
  quien envió (`sentBy`) cuando Meta informa que su mensaje falló.

## Cómo se usa desde otro módulo

```ts
import { recordOptIn, sendWhatsApp, canSendWhatsApp } from "@/modules/whatsapp/contracts"

// 1. Consentimiento: en la server action del formulario donde la persona marcó
//    una casilla explícita (no premarcada) «Acepto recibir avisos por WhatsApp».
const c = await recordOptIn({
  phone: parsed.phone, source: "form", userId: session.user.id,
  evidence: "registro v1: casilla de avisos por WhatsApp",   // sin datos personales
})
// c.ok === false && c.reason === "opted_out" → dile que escriba ALTA al número.

// 2. Envío desde un cron o un evento: plantilla (sirve a cualquier hora).
const r = await sendWhatsApp({
  to: cita.telefono,
  template: { name: "recordatorio_cita", lang: "es", params: [cita.nombre, hora] },
  userId: cita.userId,
  idempotencyKey: `cita-${cita.id}-24h`,     // un reintento no manda dos veces
})
if (!r.ok) { /* r.reason: no_optin | opted_out | outside_window | not_configured | provider_error | invalid_* */ }

// 3. Si lo dispara una persona desde una pantalla, TU acción comprueba el permiso:
if (!(await canSendWhatsApp())) return { ok: false }
await sendWhatsApp({ to, text, sentBy: session.user.id })   // texto: solo dentro de 24 h
```

API de `@/modules/whatsapp/contracts` (todo de servidor):

| Función | Qué hace |
|---|---|
| `sendWhatsApp({ to, text? \| template?, userId?, sentBy?, idempotencyKey? })` | Comprueba consentimiento, baja y ventana; guarda la fila y llama al proveedor. Devuelve `SendResult`; no lanza por una regla. **No** comprueba sesión ni permiso |
| `recordOptIn({ phone, source: "form" \| "api", userId?, evidence? })` | Registra el opt-in; no revierte una baja |
| `recordOptOut({ phone, source: "form" \| "api" \| "admin", userId? })` | Registra la baja; siempre se aplica |
| `getConsent(phone)` | `Consent` (`status: "none"` si no hay registro) |
| `listMessages({ phone?, limit? })` | Mensajes (hasta 200), del más nuevo al más viejo. **Datos personales** |
| `forgetPhone(phone)` | Borra mensajes y consentimiento del número (supresión). Borra también la baja: si la persona no quiere más mensajes, llama `recordOptOut` después |
| `canSendWhatsApp()` | `message:send` de la persona con sesión |
| `normalizePhone`, `maskPhone`, `withinServiceWindow` | Utilidades puras |

Tipos: `SendInput`, `SendResult`, `SendBlockReason`, `TemplateMessage`,
`Consent`, `WhatsAppMessage`, `WhatsAppProvider`… (en `contracts/types.ts`, puros).

## Proveedores

Interfaz `WhatsAppProvider` (`sendText`, `sendTemplate`), elegida por `WHATSAPP_PROVIDER`:

- **`meta`** — Cloud API directa por `fetch`:
  `POST https://graph.facebook.com/<versión>/<phone-number-id>/messages`, Bearer.
  Plantillas por nombre e idioma, variables en orden. Webhook firmado con el
  app secret; los eventos de otro `phone_number_id` se ignoran.
- **`fulvia`** — **PENDIENTE: el endpoint no existe todavía en la plataforma.**
  Envía `POST ${ALLFLOW_INGEST_URL}/whatsapp/messages` con
  `Authorization: Bearer ${ALLFLOW_INGEST_KEY}` y
  `{ to, type: "text", text }` o `{ to, type: "template", template: { name, lang, params } }`;
  espera `2xx { id }` o `{ error: { code } }`. Mientras no exista, cada envío
  queda `failed` (`http_404`): nunca finge éxito. Para lo entrante, la
  plataforma debería reenviar al webhook el payload de Meta tal cual, firmado
  igual (HMAC-SHA256, `X-Hub-Signature-256`) con `WHATSAPP_FULVIA_WEBHOOK_SECRET`.
- **`memory`** — no envía; para pruebas y desarrollo local. Rechazado en producción.

## Variables de entorno

| Variable | Con | |
|---|---|---|
| `WHATSAPP_PROVIDER` | siempre | `meta`, `fulvia` o `memory` |
| `WHATSAPP_META_TOKEN` | meta | token de usuario del sistema (secreto) |
| `WHATSAPP_META_PHONE_NUMBER_ID` | meta | id del número en WhatsApp Manager |
| `WHATSAPP_META_APP_SECRET` | meta | firma del webhook (secreto) |
| `WHATSAPP_META_VERIFY_TOKEN` | meta | handshake GET del webhook (secreto) |
| `WHATSAPP_META_API_VERSION` | meta, opcional | por defecto `v23.0` |
| `ALLFLOW_INGEST_URL`, `ALLFLOW_INGEST_KEY` | fulvia | las mismas del módulo `landing` |
| `WHATSAPP_FULVIA_WEBHOOK_SECRET` | fulvia | firma del reenvío entrante (pendiente) |

En Meta: suscribir el webhook a `https://<dominio>/api/whatsapp/webhook`, campo `messages`.

## Datos de ejemplo

Ninguno, a propósito: sembrar consentimientos sería inventar permisos para
escribir a números (y el seed corre también en producción). Vacía, la página
muestra el estado del proveedor y los estados vacíos.

## Datos personales

`whatsapp_messages.body` guarda el texto libre de ambas direcciones y la tabla
guarda números de teléfono. No hay retención automática: la app decide cuánto
guarda (borrado por número con `forgetPhone`). La página de admin muestra el
número y el tipo de mensaje, nunca el texto.

## Límites conocidos

- Sin reintentos ni cola: un `failed` queda así; reintentar es volver a llamar
  (con otra `idempotencyKey`, o la misma si el anterior fue `blocked`).
- Carrera mínima: una baja que llega entre la comprobación y la llamada al
  proveedor no detiene ese mensaje (milisegundos); los siguientes sí.
- Sin multimedia saliente, botones interactivos ni plantillas con encabezado o
  botones con variables: solo variables del cuerpo.
- Lo entrante que no es texto se guarda como `other`, sin el archivo.
- Sin topes de gasto por día ni por número (la app debe limitar sus crons).
- El aviso de envío fallido sale en español (se genera dentro del webhook de
  Meta, sin idioma del visitante).
- Sin integración con los usuarios de la app: `user_id` es lo que el llamador pase.
- El recurso de permiso se llama `message` (pedido así): podría chocar con otro
  módulo que use ese nombre.

## Pruebas

- `tests/whatsapp.test.ts` — sin base ni red: números, ventana, palabras clave,
  reglas de consentimiento, envío (bloqueos, ventana, idempotencia, errores del
  proveedor, que los logs no lleven texto ni número), Meta y Fulvia contra un
  `fetch` falso, configuración, firma, y el webhook completo (401, 413, 400, 500,
  duplicados, BAJA/ALTA, otro número, recibos que no retroceden, aviso único).
  **Se ejecutó: 29/29** (transpilado con TypeScript, `node --test`).
- **Sin probar:** `kyselyStore` contra Postgres (la migración y las consultas),
  una llamada real a Meta (forma tomada de la documentación de Cloud API),
  `auth.api.hasPermission` con `message` (requiere `modules:sync`), `notify`
  real, y la página y los formularios en un navegador.

## Instalar

1. Copiar la carpeta a `modules/whatsapp/` (con `notifications` ya instalado).
2. `pnpm modules:sync` (registra migración, permisos, navegación, textos y los dos shims).
3. Agregar las `env` del proveedor elegido.
4. `pnpm db:migrate`.
5. En Meta, apuntar el webhook a `/api/whatsapp/webhook` con el verify token.

## Desinstalar

Ver «Desinstalar» en `modules/README.md`: `can-remove whatsapp`, respaldar si
importa (`pg_dump -t 'whatsapp_*'`), revertir `0113_whatsapp_init` (borra
consentimientos y mensajes, **también las bajas**), borrar la carpeta,
`pnpm modules:sync`, quitar las `env` y desuscribir el webhook en Meta.

## Qué NO toca

Ningún archivo ancla ni zona protegida; nada fuera de `modules/whatsapp/`.
