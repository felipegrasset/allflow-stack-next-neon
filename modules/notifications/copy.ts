/**
 * Todo texto visible del módulo, en un solo archivo. Cuando exista el módulo
 * `i18n` (T4) levanta este archivo entero a claves; hasta entonces los
 * componentes importan de acá y no llevan literales.
 */
export const LOCALE = "es-CL"

export const copy = {
  nav: "Notificaciones",
  page: {
    title: "Notificaciones",
    subtitle: "Avisos de la app para ti.",
    listLabel: "Lista de notificaciones",
    markRead: "Marcar como leída",
    markAllRead: "Marcar todas como leídas",
    unreadTag: "Sin leer",
    open: "Abrir",
  },
  empty: {
    title: "No tienes notificaciones",
    description: "Cuando algo requiera tu atención, aparecerá acá.",
  },
  kinds: {
    info: "Aviso",
    success: "Listo",
    warning: "Atención",
    error: "Problema",
  },
  header: {
    link: "Notificaciones",
    /** "Notificaciones, 3 sin leer" para lectores de pantalla. */
    withUnread: (n: number) => `Notificaciones, ${n} sin leer`,
  },
  validation: {
    title: "El título es obligatorio (hasta 120 caracteres).",
    body: "El cuerpo admite hasta 500 caracteres.",
    href: "El enlace debe ser una ruta interna que empiece con /.",
  },
  seed: {
    title: "Bienvenido a las notificaciones",
    body: "Este aviso viene de los datos de ejemplo del módulo.",
  },
} as const
