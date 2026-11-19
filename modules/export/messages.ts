/**
 * The export module's catalog (entrypoint `messages`). Data only.
 * Error keys match the `error` codes GET /api/export/[id] returns.
 */
import type { WidenMessages } from "@/modules/contract/types"

export const es = {
  export: {
    button: {
      label: "Exportar CSV",
      exporting: "Exportando…",
    },
    errors: {
      unauthorized: "Tu sesión expiró. Vuelve a iniciar sesión para exportar.",
      forbidden: "No tienes permiso para exportar estos datos.",
      not_found: "Esta exportación no existe.",
      too_many_rows: "Hay demasiados registros para exportar de una vez. Filtra e inténtalo de nuevo.",
      failed: "No pudimos generar el archivo. Inténtalo de nuevo en un momento.",
      network: "Sin conexión. Revisa tu red e inténtalo de nuevo.",
    },
  },
} as const

export const en: WidenMessages<typeof es> = {
  export: {
    button: {
      label: "Export CSV",
      exporting: "Exporting…",
    },
    errors: {
      unauthorized: "Your session expired. Sign in again to export.",
      forbidden: "You don't have permission to export this data.",
      not_found: "This export doesn't exist.",
      too_many_rows: "There are too many records to export at once. Filter and try again.",
      failed: "We couldn't generate the file. Please try again in a moment.",
      network: "You're offline. Check your connection and try again.",
    },
  },
}
