/**
 * Textos por defecto del núcleo. Un kit los pisa pasando `title` / `description`;
 * cuando exista el módulo i18n (T4) se levantan desde acá.
 */
export const kitCopy = {
  empty: {
    title: "Todavía no hay nada aquí",
    description: "Cuando agregues el primero, aparecerá en esta lista.",
  },
  loading: { title: "Cargando", description: "Estamos preparando todo." },
  error: {
    title: "No pudimos cargar esto",
    description: "Algo salió mal de nuestro lado. Puedes intentarlo de nuevo.",
    retry: "Reintentar",
  },
  success: { title: "Listo", description: "Se guardó correctamente." },
  forbidden: {
    title: "No tienes permiso",
    description: "Pide acceso a quien administra este espacio.",
    back: "Volver",
  },
  noResults: {
    title: "Sin resultados",
    description: "Prueba con otras palabras o quita algún filtro.",
    clear: "Quitar filtros",
  },
  offline: {
    title: "Sin conexión",
    description:
      "Revisa tu internet. Reintentaremos cuando vuelvas a estar en línea.",
    retry: "Reintentar",
  },
  partial: {
    title: "Cargamos solo una parte",
    description: "Algunos datos no están disponibles por ahora:",
  },
  footer: { legal: "Todos los derechos reservados." },
  nav: { label: "Principal", footerLabel: "Pie de página" },
} as const
