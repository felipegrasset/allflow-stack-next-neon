# bookings — Reservas

> Contrato en texto plano. Un agente que instala o usa este módulo lee SOLO este
> archivo y `manifest.json`.

## Qué hace
Reservas de **recursos** (una sala, un profesional o un servicio), cada uno con
su **horario semanal de atención** y su **zona horaria**. La persona ve las
horas libres, reserva una y la cancela; quien administra ve la agenda de todos.
La base de datos impide la doble reserva: no depende de la pantalla.

## Qué expone
- **Rutas:**
  - `/bookings` (app, con sesión): agenda del día o de la semana
    (`?view=day|week&date=YYYY-MM-DD&resource=<id>`). Con `booking: manage` ve
    todas las reservas y quién reservó; sin él, solo las propias. Botón
    «Cancelar» donde corresponde.
  - `/bookings/new` (app, exige `booking: create`): recurso + fecha (formulario
    GET, `?resource=&date=`) y las horas libres para reservar.
  - `/reservar` (marketing, pública): las mismas horas libres, sin mostrar quién
    reservó. Sin sesión ofrece «Inicia sesión para reservar» (vuelve con
    `?next=`); con sesión y permiso, el formulario. Nadie reserva sin cuenta.
- **Tablas** (migración `0103_bookings_init`, requiere la extensión `btree_gist`,
  que la migración crea si falta):
  - `bookings_resources`: `id`, `name`, `kind` (`room|professional|service`),
    `details`, `timezone` (IANA), `slot_minutes` (duración de cada reserva,
    5–720), `active`.
  - `bookings_schedules`: tramos semanales `weekday` (0 = domingo … 6 =
    sábado), `start_minute`/`end_minute` (minutos desde la medianoche local,
    fin exclusivo, 1440 = medianoche), en la zona del recurso.
  - `bookings_bookings`: `resource_id`, `user_id` (→ `"user"`), `starts_at`,
    `ends_at` (instantes UTC), `status` (`confirmed|cancelled`), `note`,
    `cancelled_at`, `cancelled_by`.
- **Garantía de no doble reserva:** restricción de exclusión
  `bookings_bookings_no_overlap` (`resource_id` igual y
  `tstzrange(starts_at, ends_at, '[)')` superpuesto, solo entre `confirmed`).
  Además `createBooking` bloquea la fila del recurso (`for update`) y revisa la
  superposición dentro de la transacción; si igual choca, el 23P01 se traduce
  a `BookingError("slotTaken")`. Reservas contiguas (10:00–11:00 y 11:00–12:00)
  sí se permiten.
- **Permisos:** recurso `booking` con `create`, `cancel`, `manage`. `owner` y
  `admin` reciben todo; `member`, `create` y `cancel`. `cancel` = cancelar la
  propia antes de que empiece; `manage` = ver todas, cancelar cualquiera
  (también ya empezada) y administrar recursos. Se comprueban con
  `auth.api.hasPermission` contra la organización de la app
  (`server/access.ts`), así que los roles dinámicos también cuentan.
- **Navegación:** enlace «Reservas» → `/bookings` (clave `bookings.nav`).
- **Textos:** `messages.ts`, espacio `bookings` en `es` y `en`: `agenda.*`,
  `picker.*`, `form.*`, `newPage.*`, `publicPage.*`, `validation.*`,
  `errors.*` (una por código de `BookingError`), `notify.*`, `seed.*`.
- **Entidades que cubre (`covers`):** reserva/booking/reservation,
  cita/appointment, hora/slot, recurso/resource, sala/room,
  profesional/professional, horario/schedule. La plataforma no las genera: usa
  estas tablas y `contracts/`.
- **`contracts/`** (`@/modules/bookings/contracts`, solo servidor):
  - `getAvailability({ resourceId, from: "YYYY-MM-DD", days?: 1..31 })` →
    `{ resource, timezone, days: [{ date, slots: [{ startsAt, endsAt }] }] }`.
    Solo recursos activos; no ofrece horas que ya empezaron; un día cerrado o
    lleno viene con `slots: []`.
  - `createBooking({ resourceId, userId, startsAt, note? })` → `Booking`.
    `startsAt` tiene que ser exactamente una hora de la grilla (inicio del
    tramo + múltiplos de `slot_minutes`). Avisa al dueño con `notify()`.
  - `cancelBooking({ bookingId, byUserId, asManager? })` →
    `{ booking, changed }`. Idempotente. Avisa al dueño con `notify()`.
  - `listBookings({ from, to, userId?, resourceId?, includeCancelled? })`,
    `listResources()`, `upsertResource(input)`,
    `setWeeklySchedule(resourceId, intervals)` (reemplaza el horario entero).
  - Esquemas Zod (`bookingSchemas(copy.validation)` y los `*Schema` en
    español), tipos (`Resource`, `OpeningInterval`, `Slot`, `Availability`,
    `Booking`, `BookingWithDetails`) y `BookingError` (`code` ∈
    `resourceNotFound | outsideSchedule | inThePast | slotTaken |
    bookingNotFound | forbidden | alreadyStarted`; el texto es
    `copy.errors[code]`).
  - **Las funciones de `contracts/` NO revisan sesión ni permisos**: lo hace
    quien las llama (como las Server Actions del módulo).

Ejemplo desde otro módulo:

```ts
import { getAvailability, createBooking, BookingError } from "@/modules/bookings/contracts"

const a = await getAvailability({ resourceId: "seed-sala-pehuen", from: "2026-11-16" })
const slot = a.days[0].slots[0]
try {
  await createBooking({ resourceId: a.resource.id, userId: session.user.id, startsAt: slot.startsAt })
} catch (e) {
  if (e instanceof BookingError && e.code === "slotTaken") { /* otra hora */ }
}
```

## Zona horaria
Cada recurso tiene la suya (IANA, validada). El horario se guarda en hora local
del recurso y se convierte a UTC por fecha con `Intl` (sin offset fijo: el
cambio de horario no corre las horas). Una hora que no existe (dentro del salto
de horario de verano) no se ofrece. Las pantallas muestran las horas siempre en
la zona del recurso y con el desfase escrito («10:00», «Horas en
America/Santiago · GMT-3»). La agenda usa la zona del recurso filtrado o, sin
filtro, la del primer recurso activo.

## Depende de
`notifications` (solo `notify` de su `contracts/`) e `i18n` (contracts). Ningún
paquete nuevo.

## Variables de entorno
Ninguna.

## Datos de ejemplo
`seed.ts` (idempotente, ids fijos `seed-*`, nunca sobrescribe): «Sala Pehuén»
(sala, 60', L–V 9–13 y 14–19), «Dra. Camila Fuentes» (profesional, 45', L–V
10–13 y 15–18, sábado 10–13) y «Corte de pelo» (servicio, 30', L–V 11–20), todo
en America/Santiago. No siembra reservas. Sin recursos, las pantallas muestran
un estado vacío que explica que falta crear uno.

## Instalar
1. Copiar la carpeta a `modules/bookings/` (con `notifications` ya instalado).
2. `pnpm modules:sync`.
3. `pnpm db:migrate` (la base tiene que permitir `create extension btree_gist`;
   Neon y Postgres estándar lo permiten).

## Desinstalar
Sigue «Desinstalar» en modules/README.md: `can-remove bookings`, revertir
`0103_bookings_init` (borra las tres tablas; deja `btree_gist`), borrar la
carpeta y `pnpm modules:sync`.

## Límites conocidos (v0.1)
- **Sin pantalla para administrar recursos y horarios**: se crean por seed o
  con `upsertResource` / `setWeeklySchedule` de `contracts/`. Es lo primero que
  falta.
- Reservar exige cuenta: no hay reserva de invitados (nombre + correo).
- Duración fija por recurso; sin buffers entre reservas, sin feriados ni
  bloqueos puntuales, sin reprogramar (se cancela y se reserva otra).
- Cancelar es un formulario simple: sin diálogo de confirmación y sin mensaje
  si se rechaza (no cambia nada). Fuera de plazo, solo `manage` puede.
- Los avisos van solo a la persona que reservó, no a quien administra.
- Una persona puede tener dos reservas a la misma hora en recursos distintos.
- La agenda muestra hasta 500 reservas por período.

## Qué quedó sin probar
- `tests/bookings.test.ts` (sin base: zona horaria, grilla, esquemas, catálogo,
  guardas leídas del código) corre y pasa.
- `tests/bookings-db.test.ts` (Postgres: 8 reservas simultáneas de la misma
  hora → gana una; restricción directa; cancelar y volver a reservar) se salta
  sin `DATABASE_URL` y no se ha ejecutado contra una base.
- Las páginas, las Server Actions y `hasPermission` no se han ejecutado (sin
  `next build` ni navegador en la máquina donde se escribió).

## Qué NO toca
Ningún archivo ancla ni zona protegida; nada fuera de `modules/bookings/`.
