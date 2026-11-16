# calendar-sync — reservas en Google Calendar (v0.1)

> Contrato en texto plano. Un agente que instala o usa este módulo lee SOLO este
> archivo y `manifest.json`.

## Qué hace

Cada persona conecta **su** Google Calendar en `/settings/calendar`, y sus
reservas del módulo `bookings` aparecen como eventos en su calendario principal:
se crean al reservar, se actualizan si la reserva cambia y se borran al
cancelar.

## Sentido de la sincronización (decidido)

**Un solo sentido: de `bookings` a Google.** La reserva es la fuente de verdad.

- Si Google falla, la reserva **no** se revierte ni se toca: el evento queda
  pendiente y se reintenta.
- Si la persona edita o borra el evento en Google, la reserva no cambia. La
  próxima vez que la reserva cambie, o al reconectar, el evento vuelve a quedar
  como dice la reserva (un evento borrado en Google se restaura con el PATCH).
- Solo el calendario de **quien reservó**. No hay un calendario «de todas las
  reservas» para el equipo ni uno por recurso (ver límites).

## Garantías (cada una con prueba en `tests/calendar-sync.test.ts`)

1. **OAuth anti-CSRF.** `state` = nonce + HMAC-SHA256(nonce, id de sesión). El
   callback lo acepta solo de la **misma sesión** que lo inició, del mismo
   usuario, antes de 10 minutos y **una sola vez** (su fila se borra de forma
   atómica). Además PKCE S256; el verificador se guarda cifrado y nunca sale
   del servidor.
2. **`redirect_uri` fijo:** `publicUrl()` de `lib/site.ts` (es decir,
   `BETTER_AUTH_URL` primero) + `/api/calendar-sync/callback`. Nunca sale de la
   petición (`Host`/`X-Forwarded-Host` no cuentan). Exige `https`
   (o `http://localhost`).
3. **Tokens cifrados en reposo:** AES-256-GCM, IV aleatorio de 12 bytes por
   valor, etiqueta de 16 bytes siempre verificada, y datos asociados que atan
   cada valor a su campo y su usuario (un token copiado a otra fila no
   descifra). La llave maestra `CALENDAR_SYNC_KEY` (64 hex, se valida el
   largo) deriva con HKDF dos subllaves: una cifra, la otra firma el `state`.
   Ningún token va al cliente ni a los logs.
4. **Alcance mínimo:** solo `https://www.googleapis.com/auth/calendar.events.owned`
   (eventos de calendarios propios; más estrecho que `calendar.events`). Sin
   `openid`/`email`: el módulo no sabe qué cuenta de Google es. Si en el
   consentimiento granular la persona desmarca el calendario, no se guarda
   nada y se revoca lo concedido.
5. **Renovación y revocación:** el token de acceso se renueva cuando le queda
   menos de 1 minuto, y una vez más ante un 401. Si Google responde
   `invalid_grant` (acceso quitado o vencido), o un 403 de permisos, la cuenta
   queda `disconnected` (tokens borrados), se avisa **una vez** con `notify()`
   y las reservas quedan `skipped`, listas para enviarse al reconectar.
6. **Idempotente por reserva:** id de evento determinista (base32hex, derivado
   de reserva + usuario). Insertar dos veces da 409 y pasa a PATCH; no hay
   duplicados aunque se caiga entre Google y la base. Sin cambios, no se llama
   a Google.
7. **Reintentos:** red, 429, 5xx y límites de cuota esperan 1 min, 5 min,
   30 min, 2 h, 12 h y 24 h; después queda `failed` hasta que la reserva
   cambie. Un 4xx definitivo no se reintenta.
8. **Logs sin datos personales:** solo id de reserva, resultado y un código
   corto. Ni tokens, ni el código OAuth, ni el nombre del recurso, ni el texto
   de error de Google.

## Qué expone

- **Rutas:**
  - `GET /api/calendar-sync/connect` (route handler, público para el proxy;
    comprueba sesión y `calendar:connect`): crea el `state` y redirige a Google.
  - `GET /api/calendar-sync/callback` (ídem): valida el `state`, canjea el
    código, guarda la cuenta, envía las próximas reservas de la persona (hasta
    50) y vuelve a `/settings/calendar?status=connected|denied|scope|state|error|not_configured`.
  - `/settings/calendar` (sesión + onboarding + `calendar:connect`): estado,
    conectar o reconectar, «Sincronizar ahora», «Desconectar», y cuántas de sus
    reservas están sincronizadas, pendientes, con error o esperando conexión.
- **Tablas** (migración `0122_calendar_sync_init`):
  - `calendar_sync_accounts`: una por usuario; `status`, `disconnect_reason`
    (`user|revoked|scope`), `scopes`, `calendar_id` (`primary`),
    `access_token_enc`, `access_expires_at`, `refresh_token_enc` (cifrados).
  - `calendar_sync_states`: el nonce de cada flujo OAuth, con el verificador
    PKCE cifrado y su vencimiento.
  - `calendar_sync_events`: una por reserva (`booking_id`, sin FK a propósito):
    `event_id`, `desired` (`confirmed|cancelled`), `state`
    (`pending|synced|failed|skipped`), huella de lo enviado, copia de horas y
    título (para reintentar sin leer `bookings`), intentos y próximo intento.
- **Permisos:** recurso `calendar`, acción `connect` (conectar, desconectar y
  sincronizar **tu propio** calendario). owner, admin y member la tienen; quita
  el grant de member para apagarlo. Sin `adminAccess`.
- **Navegación:** pestaña «Calendario» en `/settings` (`area: "settings"`,
  visible con `calendar:connect`).
- **Textos:** `messages.ts`, espacio `calendar-sync`, `es` y `en`. El título y
  la descripción del evento y el aviso de desconexión salen en español (se
  generan en trabajos sin idioma del visitante).
- **Entidades que cubre:** sincronización de calendario, cuenta de Google
  Calendar, evento de calendario (y sus pares en inglés).

## Cómo se usa desde otro módulo

`bookings/contracts` no tiene un gancho «después de crear / cancelar». Quien
crea o cancela una reserva llama a `syncBookingToCalendar` después, y una tarea
programada llama a `reconcileCalendarSync` (que además recoge las reservas que
nadie avisó):

```ts
import { after } from "next/server"
import { cancelBooking, createBooking } from "@/modules/bookings/contracts"
import { syncBookingToCalendar } from "@/modules/calendar-sync/contracts"

const booking = await createBooking({ resourceId, userId: session.user.id, startsAt })
after(() => syncBookingToCalendar(booking))          // no lanza; no deshace la reserva

const { booking: b, changed } = await cancelBooking({ bookingId, byUserId: session.user.id })
if (changed) after(() => syncBookingToCalendar(b))

// Tarea programada (cron o el módulo jobs), cada 5–15 minutos:
import { reconcileCalendarSync } from "@/modules/calendar-sync/contracts"
await reconcileCalendarSync()      // → { retried, scanned, outcomes }
```

API de `@/modules/calendar-sync/contracts` (solo servidor; **no** comprueba
sesión ni permisos, como la de `bookings`; solo escribe en el calendario del
dueño de la reserva y solo si lo conectó):

| Función | Qué hace |
|---|---|
| `syncBookingToCalendar(booking)` | Acepta `Booking` o `BookingWithDetails`. Crea/actualiza o borra el evento. Devuelve `SyncOutcome` (`synced`, `deleted`, `unchanged`, `no_account`, `disconnected`, `retry`, `failed`, `not_configured`). **Nunca lanza** |
| `reconcileCalendarSync({ userId?, horizonDays?, maxBookings? })` | Reintenta lo pendiente que ya toca; compara las reservas de cada cuenta conectada (de 24 h atrás a 60 días adelante, hasta 500) con sus eventos; borra `state` vencidos. Idempotente. Lanza solo por un error de base |
| `getCalendarAccount(userId)` | `CalendarAccountView` sin tokens, o null |
| `countCalendarSync(userId)` | Cuántas reservas hay en cada estado |

## Variables de entorno

| Variable | |
|---|---|
| `GOOGLE_CLIENT_ID` | Cliente OAuth «Aplicación web» de Google Cloud, con la Calendar API habilitada |
| `GOOGLE_CLIENT_SECRET` | Su secreto |
| `CALENDAR_SYNC_KEY` | `openssl rand -hex 32` (64 hex). Si cambia, las cuentas se marcan desconectadas y hay que reconectar |

Además `BETTER_AUTH_URL` (la del núcleo) debe ser la URL pública: en Google
Cloud se registra **exactamente** `<BETTER_AUTH_URL>/api/calendar-sync/callback`.
En previews de Vercel sin `BETTER_AUTH_URL` la URL cambia por despliegue y
Google la rechazará. Sin variables, la página explica qué falta y no se llama a
Google; las reservas quedan pendientes y salen cuando se configure.

## Datos de ejemplo

Ninguno, a propósito: no hay tokens que sembrar.

## Instalar

1. Copiar la carpeta a `modules/calendar-sync/` (con `bookings` y
   `notifications` instalados).
2. `pnpm modules:sync` (migración, permisos, pestaña, textos, `env` y los tres shims).
3. Completar las `env`, registrar el redirect URI en Google Cloud.
4. `pnpm db:migrate`.
5. Agregar las llamadas a `syncBookingToCalendar` donde se crean y cancelan
   reservas, y programar `reconcileCalendarSync`.

## Desinstalar

Ver «Desinstalar» en `modules/README.md`: `can-remove calendar-sync`, revertir
`0122_calendar_sync_init` (borra cuentas, tokens y el registro de eventos; los
eventos ya creados **quedan** en los calendarios de Google), borrar la carpeta,
`pnpm modules:sync`, quitar las `env` y las llamadas al contrato.

## Límites conocidos (v0.1)

- Un solo sentido (bookings → Google); los cambios hechos en Google se ignoran.
- Solo el calendario principal de quien reservó. No hay calendario del equipo
  ni del recurso (el profesional no ve en su calendario las reservas de otros).
- Desconectar no borra los eventos ya creados.
- La reconciliación solo mira de 24 h atrás a 60 días adelante: una reserva
  fuera de esa ventana que nadie avisó no se envía.
- Sin el gancho en `bookings`, una reserva creada sin llamar al contrato tarda
  hasta la próxima reconciliación (o «Sincronizar ahora»).
- El evento lleva el nombre del recurso y un texto fijo en español; no la nota
  de la reserva.
- `sendUpdates=none`: el evento no tiene invitados.

## Qué quedó sin probar

- `tests/calendar-sync.test.ts` (sin base ni red: llave, AES-GCM, `state`,
  PKCE, ids, configuración, cliente de Google con `fetch` falso, ambos handlers
  OAuth y el motor de sincronización con almacén en memoria): **se ejecutó,
  28/28** (transpilado con TypeScript, `node --test`).
- Sin probar: `kyselyStore` contra Postgres (migración y consultas), una
  llamada real a Google (forma tomada de la documentación de OAuth 2.0 y
  Calendar API v3), `hasPermission` con `calendar` (requiere `modules:sync`),
  `notify` real, y la página en un navegador.

## Qué NO toca

Ningún archivo ancla ni zona protegida; nada fuera de `modules/calendar-sync/`.
Importa de otros módulos solo `bookings/contracts`, `notifications/contracts`
e `i18n/contracts`.
