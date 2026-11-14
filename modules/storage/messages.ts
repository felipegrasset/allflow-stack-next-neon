/**
 * The storage module's catalog (entrypoint `messages`). Data only.
 * Error keys match the `error` codes the upload route returns (UploadErrorCode).
 */
import type { WidenMessages } from "@/modules/contract/types"

export const es = {
  storage: {
    input: {
      choose: "Elegir archivo",
      uploading: "Subiendo archivo…",
      uploaded: "Archivo listo: {name}",
      view: "Ver archivo",
      remove: "Quitar archivo",
      hint: "Hasta {mb} MB. JPG, PNG, WebP, GIF o PDF.",
    },
    errors: {
      unauthorized: "Tu sesión expiró. Vuelve a iniciar sesión para subir archivos.",
      forbidden: "No tienes permiso para subir archivos.",
      too_large: "El archivo pesa más de lo permitido.",
      unsupported_type: "Ese tipo de archivo no se admite. Usa JPG, PNG, WebP, GIF o PDF.",
      empty: "El archivo está vacío.",
      bad_request: "No pudimos leer el archivo. Inténtalo de nuevo.",
      not_configured: "La subida de archivos no está configurada en esta app.",
      upload_failed: "No pudimos subir el archivo. Inténtalo de nuevo en un momento.",
      network: "Sin conexión. Revisa tu red e inténtalo de nuevo.",
    },
  },
} as const

export const en: WidenMessages<typeof es> = {
  storage: {
    input: {
      choose: "Choose file",
      uploading: "Uploading file…",
      uploaded: "File ready: {name}",
      view: "View file",
      remove: "Remove file",
      hint: "Up to {mb} MB. JPG, PNG, WebP, GIF or PDF.",
    },
    errors: {
      unauthorized: "Your session expired. Sign in again to upload files.",
      forbidden: "You don't have permission to upload files.",
      too_large: "The file is larger than allowed.",
      unsupported_type: "That file type isn't supported. Use JPG, PNG, WebP, GIF or PDF.",
      empty: "The file is empty.",
      bad_request: "We couldn't read the file. Please try again.",
      not_configured: "File uploads aren't set up in this app.",
      upload_failed: "We couldn't upload the file. Please try again in a moment.",
      network: "You're offline. Check your connection and try again.",
    },
  },
}
