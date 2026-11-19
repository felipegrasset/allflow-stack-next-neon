/**
 * Catalog of the notifications-email module (entrypoint `messages`). Data only.
 * `email.*` and `unsubscribe.*` are read directly by locale (no request in a
 * job or in the public unsubscribe route), so they take no arguments.
 */
import type { WidenMessages } from "@/modules/contract/types"

export const es = {
  "notifications-email": {
    nav: "Correo",
    page: {
      title: "Avisos por correo",
      subtitle: "Elige si, además de verlos en la app, quieres recibir tus avisos por correo.",
      sentTo: "Los enviamos a {email}.",
      noProvider: "Esta app todavía no tiene el envío de correo configurado: por ahora no se envía ninguno.",
      toggleLabel: "Recibir mis avisos por correo",
      toggleHint: "Puedes cambiarlo cuando quieras, o darte de baja desde el enlace de cualquier correo.",
    },
    form: {
      save: "Guardar",
      saving: "Guardando…",
      saved: "Preferencia guardada.",
    },
    errors: {
      forbidden: "No tienes permiso para cambiar esta preferencia.",
      invalid: "La preferencia no es válida.",
      generic: "No se pudo guardar. Inténtalo de nuevo.",
    },
    email: {
      open: "Abrir en la aplicación",
      footer: "Recibes este correo porque tienes activados los avisos por correo.",
      unsubscribe: "Dejar de recibir avisos por correo",
    },
    unsubscribe: {
      doneTitle: "Listo, no recibirás más avisos por correo",
      doneBody: "Puedes volver a activarlos cuando quieras en tus ajustes, en Correo.",
      badTitle: "No pudimos procesar el enlace",
      badBody: "El enlace no es válido. Entra a tus ajustes para cambiar la preferencia.",
    },
  },
} as const

export const en: WidenMessages<typeof es> = {
  "notifications-email": {
    nav: "Email",
    page: {
      title: "Email notifications",
      subtitle: "Choose whether you also want your notifications by email, besides seeing them in the app.",
      sentTo: "We send them to {email}.",
      noProvider: "This app has no email sending set up yet: nothing is sent for now.",
      toggleLabel: "Email me my notifications",
      toggleHint: "You can change it any time, or unsubscribe from the link in any email.",
    },
    form: {
      save: "Save",
      saving: "Saving…",
      saved: "Preference saved.",
    },
    errors: {
      forbidden: "You do not have permission to change this preference.",
      invalid: "The preference is not valid.",
      generic: "Could not save. Try again.",
    },
    email: {
      open: "Open in the app",
      footer: "You get this email because email notifications are turned on.",
      unsubscribe: "Stop receiving email notifications",
    },
    unsubscribe: {
      doneTitle: "Done, you will no longer get notification emails",
      doneBody: "You can turn them back on any time in your settings, under Email.",
      badTitle: "We could not process the link",
      badBody: "The link is not valid. Go to your settings to change the preference.",
    },
  },
}
