/**
 * The module's catalog (entrypoint `messages`). Data only. Every key is
 * `push.…`; `es` is the source, `en` has exactly the same keys and arguments.
 */
import type { WidenMessages } from "@/modules/contract/types"

export const es = {
  push: {
    nav: "Notificaciones push",
    title: "Notificaciones push",
    description:
      "Recibe los avisos de la app en este navegador o teléfono, aunque la app esté cerrada. Cada dispositivo se activa por separado.",
    notConfigured:
      "Las notificaciones push no están configuradas en esta app: faltan las llaves VAPID. Avísale a quien administra la app.",
    devices: "{n, plural, =0 {Ningún dispositivo activado} one {# dispositivo activado} other {# dispositivos activados}}",
    toggle: {
      checking: "Revisando este dispositivo…",
      enable: "Activar en este dispositivo",
      enabling: "Activando…",
      disable: "Desactivar en este dispositivo",
      disabling: "Desactivando…",
      enabled: "Activadas en este dispositivo.",
      disabled: "Desactivadas en este dispositivo.",
      unsupported:
        "Este navegador no admite notificaciones push. En iPhone o iPad, primero agrega la app a la pantalla de inicio y ábrela desde ahí.",
      denied:
        "Bloqueaste las notificaciones de este sitio. Permítelas en los ajustes del navegador y vuelve a intentarlo.",
      endpointNotAllowed: "El servicio de notificaciones de este navegador no está admitido.",
      error: "No se pudo completar. Inténtalo de nuevo.",
    },
    test: {
      button: "Enviarme una prueba",
      sending: "Enviando…",
      pushTitle: "Prueba de notificaciones",
      pushBody: "Si ves esto, las notificaciones push funcionan en este dispositivo.",
      sent: "{n, plural, =0 {No se entregó a ningún dispositivo.} one {Enviada a # dispositivo.} other {Enviada a # dispositivos.}}",
      removed: "{n, plural, one {Se quitó # dispositivo que ya no existía.} other {Se quitaron # dispositivos que ya no existían.}}",
      failed: "{n, plural, one {# envío falló.} other {# envíos fallaron.}}",
    },
    errors: {
      forbidden: "No tienes permiso para usar las notificaciones push.",
      not_configured: "Las notificaciones push no están configuradas en esta app.",
      no_devices: "Primero activa las notificaciones en este dispositivo.",
      unknown: "No se pudo enviar la prueba. Inténtalo de nuevo.",
    },
  },
} as const

export const en: WidenMessages<typeof es> = {
  push: {
    nav: "Push notifications",
    title: "Push notifications",
    description:
      "Get the app's notifications in this browser or phone, even when the app is closed. Each device is turned on separately.",
    notConfigured:
      "Push notifications are not set up in this app: the VAPID keys are missing. Let the app's administrator know.",
    devices: "{n, plural, =0 {No devices turned on} one {# device turned on} other {# devices turned on}}",
    toggle: {
      checking: "Checking this device…",
      enable: "Turn on for this device",
      enabling: "Turning on…",
      disable: "Turn off for this device",
      disabling: "Turning off…",
      enabled: "On for this device.",
      disabled: "Off for this device.",
      unsupported:
        "This browser does not support push notifications. On iPhone or iPad, add the app to the Home Screen first and open it from there.",
      denied: "You blocked notifications for this site. Allow them in the browser settings and try again.",
      endpointNotAllowed: "This browser's notification service is not supported.",
      error: "That did not work. Please try again.",
    },
    test: {
      button: "Send me a test",
      sending: "Sending…",
      pushTitle: "Notification test",
      pushBody: "If you can see this, push notifications work on this device.",
      sent: "{n, plural, =0 {Not delivered to any device.} one {Sent to # device.} other {Sent to # devices.}}",
      removed: "{n, plural, one {Removed # device that no longer existed.} other {Removed # devices that no longer existed.}}",
      failed: "{n, plural, one {# delivery failed.} other {# deliveries failed.}}",
    },
    errors: {
      forbidden: "You do not have permission to use push notifications.",
      not_configured: "Push notifications are not set up in this app.",
      no_devices: "Turn on notifications on this device first.",
      unknown: "The test could not be sent. Please try again.",
    },
  },
}
