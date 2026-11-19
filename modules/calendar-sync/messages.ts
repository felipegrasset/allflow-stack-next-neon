/**
 * Textos del módulo calendar-sync (punto de extensión `messages`). Solo datos.
 * `event.*` y `notify.*` se usan desde trabajos sin idioma de visitante: se
 * leen del catálogo fuente (español).
 */
import type { WidenMessages } from "@/modules/contract/types"

export const es = {
  "calendar-sync": {
    nav: "Calendario",
    title: "Google Calendar",
    subtitle: "Tus reservas aparecen solas en tu Google Calendar.",
    direction:
      "La sincronización va en un solo sentido: de las reservas de la app a tu calendario. Si cambias o borras el evento en Google, la reserva no cambia; para cancelar, hazlo en la app.",
    privacy:
      "Solo pedimos permiso para los eventos de tus calendarios. No leemos tu correo ni tus contactos, y no guardamos quién es tu cuenta de Google.",
    state: {
      connected: "Conectado",
      disconnected: "Desconectado",
      never: "Sin conectar",
      since: "Conectado desde {date}",
    },
    reasons: {
      user: "Lo desconectaste tú.",
      revoked: "Google ya no nos deja acceder a tu calendario (quitaste el acceso o venció). Conéctalo de nuevo; tus reservas no se perdieron.",
      scope: "Falta el permiso para los eventos del calendario. Conéctalo de nuevo y marca la casilla del calendario.",
    },
    returned: {
      connected: "Listo: tu Google Calendar quedó conectado.",
      denied: "No se conectó: cancelaste en Google.",
      scope: "No se conectó: falta marcar el permiso del calendario en Google.",
      state: "El enlace de conexión venció o no es tuyo. Vuelve a intentarlo desde aquí.",
      error: "Google no respondió como esperábamos. Vuelve a intentarlo en un rato.",
      not_configured: "La conexión con Google todavía no está configurada en esta app.",
    },
    actions: {
      connect: "Conectar Google Calendar",
      reconnect: "Conectar de nuevo",
      disconnect: "Desconectar",
      disconnecting: "Desconectando…",
      disconnected: "Se desconectó. Los eventos ya creados siguen en tu calendario.",
      confirmDisconnect: "¿Desconectar Google Calendar? Las reservas nuevas dejarán de aparecer en tu calendario.",
      syncNow: "Sincronizar ahora",
      syncing: "Sincronizando…",
      synced: "{n, plural, =0 {Todo estaba al día.} one {Se revisó # reserva.} other {Se revisaron # reservas.}}",
    },
    counts: {
      title: "Estado de tus reservas",
      synced: "{n, plural, =0 {Ninguna en tu calendario} one {# en tu calendario} other {# en tu calendario}}",
      pending: "{n, plural, =0 {Ninguna pendiente} one {# pendiente} other {# pendientes}}",
      failed: "{n, plural, =0 {Ninguna con error} one {# con error, se reintenta sola} other {# con error, se reintentan solas}}",
      skipped: "{n, plural, =0 {Ninguna esperando conexión} one {# esperando que conectes} other {# esperando que conectes}}",
    },
    config: {
      notConfigured: "Falta configurar la conexión con Google. Variables pendientes: {names}.",
      keyInvalid: "CALENDAR_SYNC_KEY debe tener 64 caracteres hexadecimales (openssl rand -hex 32).",
    },
    errors: {
      forbidden: "No tienes permiso para conectar tu calendario.",
      not_configured: "La conexión con Google todavía no está configurada.",
      unknown: "Algo salió mal. Vuelve a intentarlo.",
    },
    event: {
      summary: "Reserva: {resource}",
      description: "Reserva hecha en la app. Para cambiarla o cancelarla, entra a la app: este evento se actualiza solo.",
    },
    notify: {
      disconnectedTitle: "Tu Google Calendar se desconectó",
      disconnectedBody: "Tus reservas siguen en la app, pero ya no llegan a tu calendario. Conéctalo de nuevo en Ajustes.",
    },
  },
} as const

export const en: WidenMessages<typeof es> = {
  "calendar-sync": {
    nav: "Calendar",
    title: "Google Calendar",
    subtitle: "Your bookings show up in your Google Calendar on their own.",
    direction:
      "Sync goes one way: from the app's bookings to your calendar. Changing or deleting the event in Google does not change the booking; to cancel, do it in the app.",
    privacy:
      "We only ask for access to the events of your calendars. We do not read your email or contacts, and we do not store who your Google account is.",
    state: {
      connected: "Connected",
      disconnected: "Disconnected",
      never: "Not connected",
      since: "Connected since {date}",
    },
    reasons: {
      user: "You disconnected it.",
      revoked: "Google no longer lets us reach your calendar (access was removed or expired). Connect it again; your bookings were not lost.",
      scope: "The calendar events permission is missing. Connect again and tick the calendar box.",
    },
    returned: {
      connected: "Done: your Google Calendar is connected.",
      denied: "Not connected: you cancelled in Google.",
      scope: "Not connected: the calendar permission was not ticked in Google.",
      state: "The connection link expired or is not yours. Try again from here.",
      error: "Google did not answer as expected. Try again in a while.",
      not_configured: "The Google connection is not set up in this app yet.",
    },
    actions: {
      connect: "Connect Google Calendar",
      reconnect: "Connect again",
      disconnect: "Disconnect",
      disconnecting: "Disconnecting…",
      disconnected: "Disconnected. Events already created stay in your calendar.",
      confirmDisconnect: "Disconnect Google Calendar? New bookings will stop showing up in your calendar.",
      syncNow: "Sync now",
      syncing: "Syncing…",
      synced: "{n, plural, =0 {Everything was up to date.} one {# booking checked.} other {# bookings checked.}}",
    },
    counts: {
      title: "Your bookings",
      synced: "{n, plural, =0 {None in your calendar} one {# in your calendar} other {# in your calendar}}",
      pending: "{n, plural, =0 {None pending} one {# pending} other {# pending}}",
      failed: "{n, plural, =0 {None failed} one {# failed, retried automatically} other {# failed, retried automatically}}",
      skipped: "{n, plural, =0 {None waiting for a connection} one {# waiting for you to connect} other {# waiting for you to connect}}",
    },
    config: {
      notConfigured: "The Google connection is not set up. Missing variables: {names}.",
      keyInvalid: "CALENDAR_SYNC_KEY must be 64 hex characters (openssl rand -hex 32).",
    },
    errors: {
      forbidden: "You are not allowed to connect your calendar.",
      not_configured: "The Google connection is not set up yet.",
      unknown: "Something went wrong. Try again.",
    },
    event: {
      summary: "Booking: {resource}",
      description: "Booking made in the app. To change or cancel it, go to the app: this event updates on its own.",
    },
    notify: {
      disconnectedTitle: "Your Google Calendar was disconnected",
      disconnectedBody: "Your bookings are still in the app but no longer reach your calendar. Connect it again in Settings.",
    },
  },
}
