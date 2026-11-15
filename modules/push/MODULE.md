# push — notificaciones push web (v0.1)

> Lee solo este archivo y `manifest.json` para instalarlo, usarlo o quitarlo.

Cada persona activa las notificaciones push en sus navegadores o teléfonos
desde `/settings/notifications-push`, y otros módulos le mandan avisos que
llegan aunque la app esté cerrada. Es un **canal de `notify()`**:
`notifyWithPush` crea el aviso de `notifications` y, si es nuevo, manda el
mismo título, cuerpo y enlace por push.

**El envío se hizo sin `web-push`** (el template no lo tiene): VAPID (RFC 8292)
y el cifrado `aes128gcm` (RFC 8291 sobre RFC 8188) están escritos con
`node:crypto` y probados contra los ejemplos de los RFC. **No se probó contra
un navegador ni contra un servicio de push real** (ver «Pruebas»).

## Qué trae

| Pieza | Dónde |
|---|---|
| Tabla `push_subscriptions` (migración `0119_push_init`) | `db/` |
| Página `/settings/notifications-push` (pestaña de Ajustes) | `ui/page.tsx` |
| `POST` / `DELETE /api/push/subscribe` | `server/subscribe/route.ts` |
| `GET /api/push/sw` (el service worker) | `server/sw/route.ts`, fuente en `server/sw-script.ts` |
| API para otros módulos | `contracts/index.ts` |
| Permiso `push:subscribe` | `permissions.ts` |
| Textos `push.*` en `es` y `en` | `messages.ts` |

`dependsOn: notifications` (usa `notify` de su `contracts/`). `covers`:
suscripción push, push subscription, notificación push, push notification.
Sin seed: una suscripción inventada no sirve (sus llaves son del navegador).

## Cómo se usa desde otro módulo

```ts
import { notifyWithPush, sendPush } from "@/modules/push/contracts"

// Aviso en /notifications + push con lo mismo. Con `id`, idempotente de punta
// a punta: repetirlo no crea otro aviso ni manda otro push (push: null).
const r = await notifyWithPush({ userId, title: "Tu pedido salió", href: "/orders/42", id: "order-shipped-42" })
// → { id, created, push: { configured, devices, sent, removed, failed } | null }

// Solo el push, a todos los dispositivos de la persona:
await sendPush(userId, { title: "Recordatorio", body: "Mañana a las 10:00", href: "/bookings", tag: "booking-7" },
  { ttl: 3600, urgency: "high", topic: "booking-7" })   // opciones opcionales
```

| Función | Qué hace |
|---|---|
| `sendPush(userId, { title, body?, href?, tag? }, { ttl?, urgency?, topic? }?)` | Manda a cada suscripción de la persona. Valida con Zod (lanza `ZodError` si el payload es inválido). Nunca lanza por problemas de entrega: los cuenta. Sin VAPID devuelve `configured: false` y no manda nada |
| `notifyWithPush(input: NotifyInput, opts?)` | `notify(input)`; si el aviso es nuevo, `sendPush` con lo mismo (`tag` = `id`). Un push fallido no deshace el aviso |
| `isPushConfigured()` / `vapidPublicKey()` | Si las tres `VAPID_*` son válidas / la pública para el navegador |
| `generateVapidKeys()` | Un par nuevo, en base64url (para configurar) |

Ninguna comprueba sesión ni permiso: las llama código de servidor que ya lo
hizo. `href` solo acepta rutas internas (`/…`), igual que `notify`. Título hasta
120, cuerpo hasta 500. `ttl` por defecto 24 h (máx. 28 días), `urgency`
`normal`. `topic`: hasta 32 caracteres `[A-Za-z0-9_-]`.

Para avisar a todos los que tienen un permiso: `listUsersWithPermission` de
`notifications/contracts` y `notifyWithPush` por cada uno (no hay
`notifyPermissionWithPush` en v0.1).

## Reglas

- **404 o 410 borra la suscripción** (RFC 8030 §7.3: ya no existe). 413, 429,
  5xx, timeout (10 s) o error de red: cuenta como fallida, se queda, suma
  `failure_count`; un 2xx la deja en 0 y marca `last_success_at`.
- **Solo servicios de push conocidos** (contra SSRF, porque el endpoint lo manda
  el navegador): `https`, puerto por defecto, sin credenciales y host
  `fcm.googleapis.com`, `android.googleapis.com`, `*.push.services.mozilla.com`,
  `*.push.apple.com` o `*.notify.windows.com` (`server/endpoint.ts`). Otro host
  responde 422 al suscribir y nunca se contacta al enviar. Sin redirecciones.
- **Logs sin datos personales:** solo el host del servicio de push y el
  código de estado. Nunca el endpoint completo (es una credencial), las llaves,
  el usuario ni el texto del mensaje.
- `/api/push/subscribe` exige sesión, `content-type: application/json`, que el
  `Origin` (si viene) sea el mismo host, y `push:subscribe`. `DELETE` borra solo
  la fila de esa persona con ese endpoint. Cuerpo hasta 4 KB; llaves validadas
  (p256dh: punto P-256 válido de 65 bytes; auth: 16 bytes).
- Un mismo navegador = un endpoint = una fila: si otra persona inicia sesión en
  ese navegador y activa el push, la fila pasa a ser suya.
- Permiso `push:subscribe`: owner, admin y member. Se comprueba con
  `auth.api.hasPermission` en la página (403), la ruta y la acción de prueba.
  Nadie ve ni toca suscripciones ajenas: toda consulta filtra por el usuario de
  la sesión.

## El service worker (sin archivo en `public/`)

Un módulo no puede escribir en `public/`, y el contrato no admite rutas con
punto (`/push-sw.js`). Por eso el script lo sirve un handler en
**`/api/push/sw`** (`text/javascript`, `cache-control: no-cache`), y la página
lo registra con **scope `/api/push/`**. No hace falta `Service-Worker-Allowed`:
`push` y `notificationclick` llegan a un registro sin importar su scope, y un
scope angosto **no choca** con un service worker propio de la app en `/` (una
PWA). El worker: muestra la notificación (`title`, `body`, `tag`, `url`), al
hacer clic enfoca una pestaña del mismo origen en esa URL o abre una (nunca
otro origen), y ante `pushsubscriptionchange` se vuelve a suscribir y la
publica en `/api/push/subscribe`. No cachea nada. Sin ícono propio (el
navegador usa el del sitio).

## Configuración

| Variable | |
|---|---|
| `VAPID_PUBLIC_KEY` | P-256 sin comprimir, base64url (87 caracteres) |
| `VAPID_PRIVATE_KEY` | 32 bytes, base64url (43 caracteres). Secreto |
| `VAPID_SUBJECT` | `mailto:correo` o `https://…` (no localhost) |

Generar un par (sin dependencias):

```bash
node -e 'const e=require("crypto").createECDH("prime256v1");e.generateKeys();const k=e.getPrivateKey();console.log("VAPID_PUBLIC_KEY="+e.getPublicKey().toString("base64url"));console.log("VAPID_PRIVATE_KEY="+Buffer.concat([Buffer.alloc(32-k.length),k]).toString("base64url"))'
```

Si falta una o el par no coincide, la página dice que no está configurado, la
ruta de suscripción responde 503 y `sendPush` devuelve `configured: false`.
**Cambiar las llaves deja muertas las suscripciones existentes** (la página
detecta la llave vieja y ofrece reactivar).

## Límites conocidos

- **No probado en un navegador real** ni contra FCM, Mozilla, Apple o WNS. La
  criptografía calza byte a byte con el ejemplo del RFC 8291 y el JWT del
  RFC 8292 verifica; los encabezados siguen `web-push` 3.6. Antes de confiar en
  producción: activar en Chrome, Firefox y Safari (iOS: app agregada a la
  pantalla de inicio) y mandar la prueba de la página.
- Un idioma por envío: el texto va en el idioma que elige quien llama (no hay
  idioma por dispositivo).
- Sin cola ni reintentos: un 429/5xx no se reintenta. Envío en lotes de 10 en
  paralelo, dentro de la petición que llama.
- Las suscripciones que fallan siempre con 5xx no se borran solas
  (`failure_count` sirve para una limpieza futura).
- Apple exige la app instalada en la pantalla de inicio en iOS/iPadOS.
- La lista de servicios de push es fija; un navegador con otro servicio
  recibe «servicio no admitido».

## Pruebas

- `tests/crypto.test.ts` — VAPID y `aes128gcm` contra el RFC 8291 §5 y
  Apéndice A (secreto ECDH, IKM, CEK, NONCE y el cuerpo cifrado exacto;
  descifrar ese cuerpo da «When I grow up, I want to be a watermelon») y el
  JWT de ejemplo del RFC 8292 §2.4 (verifica con su `k`); ida y vuelta,
  manipulación, tope de 24 h del `exp`. **Se ejecutó: 9/9.**
- `tests/push.test.ts` — lista de hosts, config VAPID, payload, la petición
  (encabezados y cuerpo que el «navegador» descifra), entrega contra un
  servicio falso (201 enviada; 404/410 borradas; 429/500/red se quedan; logs
  sin endpoint ni llaves), handlers con dependencias inyectadas, la ruta del
  worker y, leyendo el código, las guardas. **Se ejecutó: 15/15** (desde la
  raíz del repo, transpilado a una carpeta temporal).
- Sin probar: las consultas contra Postgres (no hay prueba con base), la página
  y el botón en un navegador, el service worker, `hasPermission` con el recurso
  `push` (requiere `modules:sync`).

## Instalar

1. Copiar la carpeta a `modules/push/` (necesita `notifications` instalado).
2. `pnpm modules:sync` (registros, shims de `app/api/push/subscribe/route.ts`,
   `app/api/push/sw/route.ts`, `app/(app)/settings/notifications-push/page.tsx`
   y el bloque de `.env.example`).
3. Generar las llaves y poner las tres `VAPID_*` en `.env.local` / Vercel.
4. `pnpm db:migrate`.

## Desinstalar

Seguir `modules/README.md` («Desinstalar»): revertir `0119_push_init` (borra
la tabla y las suscripciones), quitar la carpeta, `pnpm modules:sync`, quitar
las `VAPID_*`. Antes, que ningún módulo importe `@/modules/push/contracts`.
Los navegadores conservan el worker registrado en `/api/push/` hasta que la
persona lo quite; tras la desinstalación `/api/push/sw` responde 404 y el
navegador lo da de baja en su siguiente revisión.

## Qué NO toca

Ningún archivo ancla ni zona protegida, nada fuera de `modules/push/`, ningún
paquete nuevo. De otro módulo solo importa `@/modules/notifications/contracts`
y `@/modules/i18n/contracts/*`.
